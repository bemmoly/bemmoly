import { fileURLToPath } from 'node:url';
import {
  defineContextBuilder,
  defineInsightGenerator,
  type EventBus,
  type ModuleContext,
  type RealtimePublisher,
  type SqlClient,
} from '@bemmoly/core';
import { AI_INSIGHT_EVENT_KINDS } from '@bemmoly/shared';
import { WORK_REALTIME_KINDS } from '../../../../shared/realtime.ts';
import { createWorkActivitySource } from './activity.ts';
import { createIssueContextBuilder } from './issue-context.ts';
import { createIssueDetailsSource } from './related.ts';
import { createSprintContextBuilder } from './sprint-context.ts';

export { createIssueContextBuilder, ISSUE_CONTEXT_LIMITS } from './issue-context.ts';
export { createSprintContextBuilder, SPRINT_CONTEXT_LIMITS } from './sprint-context.ts';
export { createWorkActivitySource } from './activity.ts';
export { createIssueDetailsSource } from './related.ts';

export const WORK_AI_BUILDERS = {
  issue: 'work.issue',
  sprint: 'work.sprint',
  activity: 'work.activity',
  issueDetails: 'work.issue_details',
} as const;

export const WORK_PROMPT_FILES = {
  issueSummary: fileURLToPath(new URL('./prompts/issue-summary.md', import.meta.url)),
  sprintPulse: fileURLToPath(new URL('./prompts/sprint-pulse.md', import.meta.url)),
} as const;

/** The sprint pulse waits for five quiet minutes after the last change in its sprint. */
export const SPRINT_PULSE_QUIET_SECONDS = 300;

/**
 * Work's AI: issueContext, sprintContext and its share of the activity context, the issue
 * summary and sprint pulse generators, and their prompts. With AI off none of it runs; the
 * kernel refuses every insight before a builder is asked.
 */
export function registerWorkAi(
  ctx: Pick<ModuleContext, 'ai'>,
  database: SqlClient | undefined,
): void {
  const sql = () => database;
  ctx.ai.addContextBuilder(
    defineContextBuilder(
      WORK_AI_BUILDERS.issue,
      'An issue, its comments, history and blockers',
      createIssueContextBuilder(sql),
    ),
  );
  ctx.ai.addContextBuilder(
    defineContextBuilder(
      WORK_AI_BUILDERS.sprint,
      'A sprint, its issues, points and waits',
      createSprintContextBuilder(sql),
    ),
  );
  ctx.ai.addContextBuilder(
    defineContextBuilder(
      WORK_AI_BUILDERS.activity,
      'Issues and sprints that changed',
      createWorkActivitySource(sql),
    ),
  );
  ctx.ai.addContextBuilder(
    defineContextBuilder(
      WORK_AI_BUILDERS.issueDetails,
      "An issue's fields and description, for other modules' context",
      createIssueDetailsSource(sql),
    ),
  );
  ctx.ai.addInsightGenerator(
    defineInsightGenerator('The AI summary on an issue', {
      kind: 'issue_summary',
      builder: WORK_AI_BUILDERS.issue,
      promptId: 'work.issue_summary',
      purpose: 'summary',
    }),
  );
  ctx.ai.addInsightGenerator(
    defineInsightGenerator('The sprint risk bar on the Board and Backlog', {
      kind: 'sprint_pulse',
      builder: WORK_AI_BUILDERS.sprint,
      promptId: 'work.sprint_pulse',
      purpose: 'pulse',
    }),
  );
  ctx.ai.addPromptFile({ name: 'work.issue_summary', path: WORK_PROMPT_FILES.issueSummary });
  ctx.ai.addPromptFile({ name: 'work.sprint_pulse', path: WORK_PROMPT_FILES.sprintPulse });
}

/**
 * The services' realtime publisher, plus the AI triggers every change already passes through:
 * a sprint invalidation asks for its pulse after the quiet period, and an issue invalidation
 * tells other modules (Docs' consistency checks) that the issue changed. Both join the
 * publisher's transaction, so a rolled back write asks for nothing.
 */
export function withAiTriggers(realtime: RealtimePublisher, events: EventBus): RealtimePublisher {
  return {
    async publish(message, options) {
      await realtime.publish(message, options);
      const transaction = options?.transaction ? { transaction: options.transaction } : {};
      if (message.ids.length === 0) return;
      if (message.kind === WORK_REALTIME_KINDS.sprint) {
        await events.publish({
          kind: AI_INSIGHT_EVENT_KINDS.requested,
          occurredAt: new Date(),
          payload: {
            kind: 'sprint_pulse',
            targetIds: message.ids,
            quietSeconds: SPRINT_PULSE_QUIET_SECONDS,
          },
          ...transaction,
        });
      }
      if (message.kind === WORK_REALTIME_KINDS.issue) {
        await events.publish({
          kind: AI_INSIGHT_EVENT_KINDS.sourceChanged,
          occurredAt: new Date(),
          payload: { kind: 'issue', ids: message.ids },
          ...transaction,
        });
      }
    },
  };
}
