import {
  AI_INSIGHT_OUTPUT_SCHEMAS,
  type ConsistencyOutput,
  type IssueSummaryOutput,
  type MorningBriefOutput,
  type PageTldrOutput,
  type SprintPulseOutput,
} from '@bemmoly/shared/ai-insights';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  citesOnlyOffered,
  everyPointCites,
  findsRollbackConflict,
  noOtherFindings,
} from './checks.ts';
import {
  briefContext,
  consistencyContext,
  issueSummaryContext,
  pageTldrContext,
  sprintPulseContext,
  type EvalContext,
} from './fixture/contexts.ts';
import { evalCase, pass, replyOf } from './harness.ts';

/*
 * The insight prompts: summaries, the TL;DR, the sprint pulse, the morning brief and the
 * consistency check, each called as the insight service calls it (structured output against
 * the kind's schema, no actor) over the Acme Labs context.
 */

type Kind = keyof typeof AI_INSIGHT_OUTPUT_SCHEMAS;

async function insight<Output>(
  caseId: string,
  promptId: string,
  kind: Kind,
  context: EvalContext,
): Promise<Output> {
  const { ai, save } = await evalCase(caseId);
  const prompt = await ai.facade.renderPrompt(promptId, context.variables);
  expect(prompt.outputSchema).toBe(kind);
  const result = await ai.facade.generate<Output>({
    role: prompt.role,
    purpose: 'insight',
    system: prompt.system,
    prompt: prompt.prompt,
    promptRef: prompt.promptRef,
    schema: AI_INSIGHT_OUTPUT_SCHEMAS[kind] as unknown as z.ZodType<Output>,
    actor: null,
  });
  await save(prompt.promptRef, [replyOf(result)]);
  return result.object as Output;
}

const nextCites = (steps: readonly { cite: string }[], offered: Set<string>) =>
  citesOnlyOffered(
    steps.map((step) => step.cite),
    offered,
  );

describe('work.issue_summary', () => {
  it('cites at least one source for every point, and only sources it was given', async () => {
    const context = issueSummaryContext();
    const output = await insight<IssueSummaryOutput>(
      'work-issue-summary',
      'work.issue_summary',
      'issue_summary',
      context,
    );
    pass(everyPointCites(output.points, context.offered));
    pass(nextCites(output.next, context.offered));
    expect(output.points.length).toBeGreaterThanOrEqual(2);
    expect(output.points.length).toBeLessThanOrEqual(4);
  });
});

describe('docs.tldr', () => {
  it('leads with the decision in at most three cited points', async () => {
    const context = pageTldrContext();
    const output = await insight<PageTldrOutput>('docs-tldr', 'docs.tldr', 'page_tldr', context);
    pass(everyPointCites(output.points, context.offered));
    expect(output.points.length).toBeLessThanOrEqual(3);
    expect(output.points[0]!.text).toMatch(/Postgres/);
  });
});

describe('work.sprint_pulse', () => {
  it('names the review that holds the sprint, with its numbers, and cites it', async () => {
    const context = sprintPulseContext();
    const output = await insight<SprintPulseOutput>(
      'work-sprint-pulse',
      'work.sprint_pulse',
      'sprint_pulse',
      context,
    );
    expect(output.risk).not.toBe('on_track');
    expect(output.headline.text).toMatch(/PLT-204/);
    expect(output.headline.text.split(/\s+/).length).toBeLessThanOrEqual(30);
    pass(everyPointCites([output.headline], context.offered));
    pass(nextCites(output.next, context.offered));
  });
});

describe('ai.brief', () => {
  it('leads with what waits on the person, cited, in at most four points', async () => {
    const context = briefContext();
    const output = await insight<MorningBriefOutput>(
      'ai-brief',
      'ai.brief',
      'morning_brief',
      context,
    );
    pass(everyPointCites(output.points, context.offered));
    pass(nextCites(output.next, context.offered));
    expect(output.points.length).toBeLessThanOrEqual(4);
    expect(output.points[0]!.text).toMatch(/PLT-204/);
  });
});

describe('docs.consistency', () => {
  it('finds the planted 15 versus 30 minute rollback conflict, and nothing else', async () => {
    const context = consistencyContext();
    const output = await insight<ConsistencyOutput>(
      'docs-consistency',
      'docs.consistency',
      'consistency',
      context,
    );
    pass(findsRollbackConflict(output.findings, context.offered));
    pass(noOtherFindings(output.findings));
  });
});
