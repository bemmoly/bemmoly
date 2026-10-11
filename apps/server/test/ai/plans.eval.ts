import type { AiTool } from '@bemmoly/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { planTouchesOnly, type ProposedCall } from './checks.ts';
import { ISSUES, SPRINTS, TODAY, issueByKey, nameOf } from './fixture/acme.ts';
import { evalCase, pass } from './harness.ts';

/*
 * ai.plan: the palette's planner. Read tools answer from the Acme Labs sample; write tools
 * carry Work's names and have no execute, so the model only proposes, as in production.
 */

const WRITE_TOOLS = new Set([
  'work_move_to_sprint',
  'work_change_status',
  'work_assign_issue',
  'work_add_comment',
]);

const key = z.object({ key: z.string().regex(/^[A-Z]+-\d+$/) });

function planTools(reads: ProposedCall[]): Record<string, AiTool<never>> {
  const read = <I extends object>(
    description: string,
    inputSchema: z.ZodType<I>,
    answer: (input: I) => unknown,
    toolName: string,
  ): AiTool<never> =>
    ({
      description,
      inputSchema,
      execute: async (input: I) => {
        reads.push({ toolName, input });
        return answer(input);
      },
    }) as unknown as AiTool<never>;
  const write = (description: string, inputSchema: z.ZodType): AiTool<never> =>
    ({ description, inputSchema }) as AiTool<never>;
  const facts = (issueKey: string) => {
    const issue = issueByKey(issueKey);
    if (!issue) return { error: `There is no issue ${issueKey}` };
    return { ...issue, assignee: nameOf(issue.assignee) };
  };
  return {
    work_search_issues: read(
      'Find issues. q is an LQL query, for example: project = PLT AND status != Done, or text ~ "cookie". Returns key, title, status, sprint and assignee.',
      z.object({ q: z.string() }),
      ({ q }) =>
        ISSUES.filter((issue) =>
          q
            .toLowerCase()
            .split(/\W+/)
            .some((term) => term.length > 3 && issue.title.toLowerCase().includes(term)),
        ).map(({ key: k, title, status, sprint, assignee }) => ({
          key: k,
          title,
          status,
          sprint,
          assignee: nameOf(assignee),
        })),
      'work_search_issues',
    ),
    work_get_issue: read(
      'One issue by key, with its status, sprint, assignee, labels and the issues blocking it.',
      key,
      ({ key: k }) => facts(k),
      'work_get_issue',
    ),
    work_list_sprints: read(
      "A project's sprints with their ids, names, states and dates.",
      z.object({ projectKey: z.string() }),
      () => SPRINTS.map(({ id, name, state, start, end }) => ({ id, name, state, start, end })),
      'work_list_sprints',
    ),
    work_move_to_sprint: write(
      'Move an issue to a sprint (sprintId from work_list_sprints), or to the backlog with null.',
      key.extend({ sprintId: z.string().nullable() }),
    ),
    work_change_status: write(
      "Change an issue's status (statusId from the issue's transitions).",
      key.extend({ statusId: z.string() }),
    ),
    work_assign_issue: write(
      'Assign an issue to a project member, or unassign it with null.',
      key.extend({ assigneeId: z.string().nullable() }),
    ),
    work_add_comment: write(
      'Add a comment to an issue. Bemmoly signs it for the person.',
      key.extend({ body: z.string().min(1) }),
    ),
  };
}

async function plan(caseId: string, request: string) {
  const { ai, save } = await evalCase(caseId);
  const prompt = await ai.facade.renderPrompt('ai.plan', {
    person: 'Rohan S.',
    today: TODAY,
    context: 'Board of Platform (PLT), Sprint 14',
    request,
  });
  const reads: ProposedCall[] = [];
  const result = await ai.facade.generate({
    role: prompt.role,
    purpose: 'plan',
    system: prompt.system,
    prompt: prompt.prompt,
    promptRef: prompt.promptRef,
    tools: planTools(reads),
    maxSteps: 8,
  });
  const writes = result.toolCalls.map(({ toolName, input }) => ({ toolName, input }));
  await save(prompt.promptRef, [
    ...(reads.length ? [{ toolCalls: reads }] : []),
    writes.length ? { toolCalls: writes } : { text: result.text },
  ]);
  return { writes, text: result.text };
}

describe('ai.plan', () => {
  it('touches only the issues the request names', async () => {
    const { writes } = await plan(
      'ai-plan-named-issues',
      'Move PLT-211 and PLT-219 to Sprint 15 and leave a comment on each saying they wait on PLT-204.',
    );
    pass(planTouchesOnly(writes, WRITE_TOOLS, new Set(['PLT-211', 'PLT-219'])));
    const moved = writes.filter((call) => call.toolName === 'work_move_to_sprint');
    expect(moved.map((call) => (call.input as { sprintId: string }).sprintId)).toEqual([
      's-15',
      's-15',
    ]);
  });

  it('proposes no change when the request is a question', async () => {
    const { writes, text } = await plan(
      'ai-plan-question',
      'How many points are still open in Sprint 14?',
    );
    expect(writes.filter((call) => WRITE_TOOLS.has(call.toolName))).toEqual([]);
    expect(text.trim()).not.toBe('');
  });
});
