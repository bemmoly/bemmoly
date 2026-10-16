import type { SendJobOptions, SettingsRegistry } from '@bemmoly/core';
import type { PipelinesCodeHosts } from '../code/hosts.ts';
import { z } from 'zod';
import type { PipelinesServiceDeps } from '../deps.ts';
import type { RunOutcome } from '../orchestrator/advance.ts';
import type { RunHooks } from './hooks.ts';

/** What the run, runner and trigger services share. */
export interface ExecutionDeps extends PipelinesServiceDeps {
  settings?: Pick<SettingsRegistry, 'get'>;
  hooks: RunHooks;
  /** The connected code hosts, for check runs; absent without one. */
  code?: PipelinesCodeHosts;
  sendJob?: (
    name: string,
    payload: Record<string, unknown>,
    options?: SendJobOptions,
  ) => Promise<unknown>;
}

/** Queues a check run update for a job's new state; nothing without a code host. */
export async function queueCheck(
  deps: ExecutionDeps,
  job: { id: string; attempt: number },
  state: string,
) {
  if (!deps.code || !deps.sendJob) return;
  await deps.sendJob(
    'pipelines.report-check',
    { jobId: job.id },
    {
      idempotencyKey: `check:${job.id}:${job.attempt}:${state}`,
    },
  );
}

/** Queues the one failed check of a run that could not start; nothing without a code host. */
export async function queueRunCheck(deps: ExecutionDeps, runId: string) {
  if (!deps.code || !deps.sendJob) return;
  await deps.sendJob('pipelines.report-check', { runId }, { idempotencyKey: `check:run:${runId}` });
}

export interface RunDefaults {
  defaultTimeoutMinutes: number;
  defaultPoolKey: string;
}

const timeoutSchema = z
  .number()
  .int()
  .min(1)
  .max(24 * 60);
const poolSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/);

async function setting<T>(read: () => Promise<unknown>, schema: z.ZodType<T>, fallback: T) {
  try {
    const parsed = schema.safeParse(await read());
    return parsed.success ? parsed.data : fallback;
  } catch {
    // A process without settings (a script, a test) runs with the documented defaults.
    return fallback;
  }
}

export async function runDefaults(deps: ExecutionDeps): Promise<RunDefaults> {
  const settings = deps.settings;
  return {
    defaultTimeoutMinutes: settings
      ? await setting(() => settings.get('pipelines.jobs.defaultTimeoutMinutes'), timeoutSchema, 60)
      : 60,
    defaultPoolKey: settings
      ? await setting(() => settings.get('pipelines.runners.defaultPool'), poolSchema, 'linux-x64')
      : 'linux-x64',
  };
}

/** Tells listeners about runs that finished, once their transaction has committed. */
export async function announce(deps: ExecutionDeps, outcomes: readonly RunOutcome[]) {
  for (const outcome of outcomes) {
    if (outcome.finished)
      await deps.hooks.emitFinished({ runId: outcome.runId, state: outcome.state });
  }
}
