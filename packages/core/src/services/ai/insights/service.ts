import {
  AI_INSIGHT_EVENT_KINDS,
  aiInsightRequestedPayloadSchema,
  aiInsightSchema,
  NotFoundError,
  type AiFeedback,
  type AiInsight,
  type AiInsightKind,
  type AiInsightState,
} from '@bemmoly/shared';
import { z } from 'zod';
import type { AiFacade } from '../../../contracts/ai.ts';
import type { EventBus } from '../../../contracts/event-bus.ts';
import type { JobQueue } from '../../../contracts/jobs.ts';
import type { RealtimePublisher } from '../../../contracts/realtime.ts';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import type { ModuleRegistry } from '../../../modules/registry.ts';
import type { RequestContext } from '../../authz/index.ts';
import { aiRefusal } from '../refusals.ts';
import { ACTIVITY_CONTEXT_BUILDER, createActivityContextBuilder } from '../context/activity.ts';
import { createMorningBriefGenerator, peopleDueABrief } from './brief.ts';
import { cacheKeyOf, regenerate } from './generate.ts';
import { createInsightRegistry, type ResolvedGenerator } from './registry.ts';
import { createInsightStore, type InsightRow } from './store.ts';

export const AI_INSIGHT_JOB = 'ai.insight';
export const AI_BRIEF_JOB = 'ai.brief';

export interface InsightsServiceDeps {
  ai: AiFacade;
  database: SqlExecutor;
  jobs: JobQueue;
  realtime: RealtimePublisher;
  events: EventBus;
  modules: ModuleRegistry;
  isEnabled(moduleId: string): boolean;
  now?: () => Date;
}

const jobPayloadSchema = z.object({
  kind: z.string(),
  targetId: z.uuid(),
  quietSeconds: z.number().int().min(0).optional(),
  force: z.boolean().optional(),
});
type JobPayload = z.infer<typeof jobPayloadSchema>;

function present(
  resolved: ResolvedGenerator,
  targetId: string,
  row: InsightRow | null,
  state: AiInsightState,
): AiInsight {
  const candidate = {
    id: row?.id ?? null,
    kind: resolved.generator.kind,
    targetKind: resolved.builder.targetKind,
    targetId,
    state,
    error: state === 'failed' ? (row?.error ?? null) : null,
    generatedAt: row?.generatedAt?.toISOString() ?? null,
    feedback: row?.feedback ?? null,
    content: row?.content ?? null,
  };
  const parsed = aiInsightSchema.safeParse(candidate);
  // Content stored under an older schema is not shown as data; the next refresh replaces it.
  return parsed.success ? parsed.data : aiInsightSchema.parse({ ...candidate, content: null });
}

/**
 * The insight cache (tech design 11.5). A view compares the stored hash with the inputs' hash:
 * unchanged returns the row at once; changed returns the stale content marked "refreshing" and
 * queues one regeneration per target, which publishes `ai.insight` when done.
 */
export function createInsightsService(deps: InsightsServiceDeps) {
  const now = deps.now ?? (() => new Date());
  const store = createInsightStore(deps.database);
  const registry = createInsightRegistry({
    modules: deps.modules,
    isEnabled: deps.isEnabled,
    builders: {
      [ACTIVITY_CONTEXT_BUILDER]: createActivityContextBuilder({
        database: deps.database,
        sources: () => registry.activitySources(),
      }),
    },
    generators: [createMorningBriefGenerator(deps.database)],
  });
  const generation = { ai: deps.ai, store, realtime: deps.realtime, now };

  const resolve = (kind: string): ResolvedGenerator => {
    const resolved = registry.resolve(kind as AiInsightKind);
    if (!resolved) throw new NotFoundError('This kind of AI insight is not available');
    return resolved;
  };

  const enqueue = (
    payload: JobPayload,
    options: { startAfter?: number; transaction?: SqlExecutor } = {},
  ) =>
    deps.jobs.enqueue(AI_INSIGHT_JOB, payload, {
      key: `${payload.kind}:${payload.targetId}${payload.quietSeconds ? ':quiet' : ''}`,
      singleton: true,
      ...options,
    });

  /** AI on for this person, and the person may open the target. */
  async function admit(ctx: RequestContext, resolved: ResolvedGenerator, targetId: string) {
    const policy = await deps.ai.policy(ctx.actor);
    if (!policy.enabled) throw aiRefusal('ai_off');
    if (policy.actorOptedOut) throw aiRefusal('opted_out');
    if (!(await resolved.builder.canView(ctx, targetId))) {
      throw new NotFoundError('Not found');
    }
  }

  async function view(ctx: RequestContext, kind: string, targetId: string): Promise<AiInsight> {
    const resolved = resolve(kind);
    await admit(ctx, resolved, targetId);
    const { generator, builder } = resolved;
    const row = await store.find(builder.targetKind, targetId, generator.kind);
    const policy = await deps.ai.policy(null);
    const key = await cacheKeyOf(resolved, targetId, policy, now(), row?.generatedAt ?? null);
    if (key === null) throw new NotFoundError('Not found');
    if (row && row.inputHash === key) {
      return present(resolved, targetId, row, row.status === 'failed' ? 'failed' : 'ready');
    }
    if (generator.refreshOnView === false) return present(resolved, targetId, row, 'ready');
    await enqueue({ kind: generator.kind, targetId });
    return present(resolved, targetId, row, row?.content ? 'refreshing' : 'pending');
  }

  /** Handles one `ai.insight` job, waiting out a quiet period first when asked to. */
  async function handleJob(payload: unknown): Promise<void> {
    const job = jobPayloadSchema.parse(payload);
    const resolved = registry.resolve(job.kind as AiInsightKind);
    if (!resolved) return;
    if (job.quietSeconds && resolved.builder.lastChangedAt) {
      const last = await resolved.builder.lastChangedAt(job.targetId);
      const waited = last ? now().getTime() - last.getTime() : Infinity;
      if (waited < job.quietSeconds * 1000) {
        await enqueue(job, { startAfter: Math.ceil(job.quietSeconds - waited / 1000) });
        return;
      }
    }
    await regenerate(generation, resolved, job.targetId, { force: job.force ?? false });
  }

  /** The hourly sweep: a brief for everyone whose local clock reads 6 a.m. */
  async function sweepBriefs(): Promise<number> {
    const policy = await deps.ai.policy(null);
    if (!policy.enabled) return 0;
    const due = await peopleDueABrief(deps.database, now(), policy.optedOutUserIds);
    for (const { userId, localDate } of due) {
      await deps.jobs.enqueue(
        AI_INSIGHT_JOB,
        { kind: 'morning_brief', targetId: userId },
        { key: `morning_brief:${userId}:${localDate}` },
      );
    }
    return due.length;
  }

  return {
    get: view,

    /** "Try again": regenerates even when the inputs have not changed. */
    async refresh(ctx: RequestContext, kind: string, targetId: string): Promise<AiInsight> {
      const resolved = resolve(kind);
      await admit(ctx, resolved, targetId);
      const { generator, builder } = resolved;
      const row = await store.find(builder.targetKind, targetId, generator.kind);
      await enqueue({ kind: generator.kind, targetId, force: true });
      return present(resolved, targetId, row, row?.content ? 'refreshing' : 'pending');
    },

    async feedback(ctx: RequestContext, id: string, feedback: AiFeedback): Promise<void> {
      const row = await store.findById(id);
      if (!row) throw new NotFoundError('Not found');
      await admit(ctx, resolve(row.kind), row.targetId);
      await store.setFeedback(row.id, feedback, row.runId);
    },

    /** Runs one regeneration now; the job handler and tests call it. */
    regenerate: (kind: AiInsightKind, targetId: string, options: { force?: boolean } = {}) =>
      regenerate(generation, resolve(kind), targetId, options),

    handleJob,
    sweepBriefs,

    /** Registers the jobs and the request subscription; call once modules are loaded. */
    start(): void {
      deps.jobs.register(AI_INSIGHT_JOB, handleJob, {
        retryLimit: 2,
        concurrency: 2,
      });
      deps.jobs.register(AI_BRIEF_JOB, async () => void (await sweepBriefs()), {
        schedule: '0 * * * *',
        retryLimit: 0,
      });
      deps.events.subscribe(AI_INSIGHT_EVENT_KINDS.requested, async (event) => {
        const request = aiInsightRequestedPayloadSchema.parse(event.payload);
        for (const targetId of request.targetIds) {
          await enqueue(
            {
              kind: request.kind,
              targetId,
              ...(request.quietSeconds > 0 ? { quietSeconds: request.quietSeconds } : {}),
            },
            {
              ...(request.quietSeconds > 0 ? { startAfter: request.quietSeconds } : {}),
              ...(event.transaction ? { transaction: event.transaction } : {}),
            },
          );
        }
      });
    },
  };
}

export type InsightsService = ReturnType<typeof createInsightsService>;
