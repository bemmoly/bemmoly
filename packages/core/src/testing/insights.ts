import type { AiFacade } from '../contracts/ai.ts';
import type { EventBus } from '../contracts/event-bus.ts';
import type { EnqueueOptions, JobQueue } from '../contracts/jobs.ts';
import type { RealtimeMessage } from '../contracts/realtime.ts';
import type { SqlExecutor } from '../contracts/sql.ts';
import { emptyContributions, type ModuleContributions } from '../modules/contributions.ts';
import { createLocalEventBus } from '../modules/local-event-bus.ts';
import { ModuleRegistry } from '../modules/registry.ts';
import { createInsightsService, type InsightsService } from '../services/ai/index.ts';

export interface RecordedJob {
  name: string;
  payload: object;
  options: EnqueueOptions;
}

export interface TestInsights {
  insights: InsightsService;
  /** Every enqueue, in order; singleton keys still waiting collapse as pg-boss does. */
  jobs: RecordedJob[];
  realtime: RealtimeMessage[];
  events: EventBus;
  /** Runs every recorded `ai.insight` job not yet run, in order. */
  drain(): Promise<number>;
  setNow(date: Date): void;
}

/** A module's AI contributions, as a fake module, for tests outside a full boot. */
export function moduleWithAi(
  id: string,
  ai: Partial<Pick<ModuleContributions, 'aiContextBuilders' | 'aiInsightGenerators'>>,
): { id: string; contributions: ModuleContributions } {
  return { id, contributions: { ...emptyContributions(), ...ai } };
}

/**
 * The insight service over a real database with a recording job queue, so module tests can
 * view, drain the queue and view again without pg-boss.
 */
export function createTestInsights(options: {
  ai: AiFacade;
  database: SqlExecutor;
  modules: readonly { id: string; contributions: ModuleContributions }[];
  events?: EventBus;
  now?: Date;
}): TestInsights {
  const registry = new ModuleRegistry();
  for (const { id, contributions } of options.modules) {
    const module = {
      id,
      version: '0.0.0',
      coreApi: '^0.1.0',
      defaultAccess: 'everyone',
      changelog: [],
      register: () => undefined,
    } as const;
    registry.add(module, contributions);
  }
  const jobs: RecordedJob[] = [];
  const realtime: RealtimeMessage[] = [];
  const events = options.events ?? createLocalEventBus();
  let now = options.now ?? new Date();
  let ran = 0;
  const waiting = new Set<string>();
  const queue: JobQueue = {
    register: () => undefined,
    async enqueue(name, payload, enqueueOptions = {}) {
      if (enqueueOptions.key && enqueueOptions.singleton && waiting.has(enqueueOptions.key)) {
        return null;
      }
      if (enqueueOptions.key && enqueueOptions.singleton) waiting.add(enqueueOptions.key);
      jobs.push({ name, payload, options: enqueueOptions });
      return `job-${jobs.length}`;
    },
  };
  const insights = createInsightsService({
    ai: options.ai,
    database: options.database,
    jobs: queue,
    realtime: { publish: async (message) => void realtime.push(message) },
    events,
    modules: registry,
    isEnabled: () => true,
    now: () => now,
  });
  insights.start();
  return {
    insights,
    jobs,
    realtime,
    events,
    async drain() {
      let count = 0;
      while (ran < jobs.length) {
        const job = jobs[ran++]!;
        if (job.options.key) waiting.delete(job.options.key);
        if (job.name !== 'ai.insight') continue;
        await insights.handleJob(job.payload);
        count += 1;
      }
      return count;
    },
    setNow(date) {
      now = date;
    },
  };
}
