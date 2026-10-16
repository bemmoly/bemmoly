import type { ModuleContext } from '@bemmoly/core';
import { sweepJobs } from '../services/dispatcher/sweep.ts';
import type { PipelinesServices } from '../services/index.ts';

/*
 * The background work running pipelines needs: due schedules every minute, and a sweep for
 * lost runners and timeouts in case no runner is claiming on any replica to piggyback on.
 */

export const SCHEDULES_JOB = 'pipelines.schedules';
export const DISPATCH_SWEEP_JOB = 'pipelines.dispatch-sweep';

export function registerExecutionWork(ctx: ModuleContext, services: PipelinesServices): void {
  ctx.jobs.add({
    name: SCHEDULES_JOB,
    schedule: '* * * * *',
    singleton: true,
    expireInSeconds: 120,
    async handle() {
      await services.triggers.runDueSchedules();
    },
  });
  ctx.jobs.add({
    name: DISPATCH_SWEEP_JOB,
    schedule: '* * * * *',
    singleton: true,
    expireInSeconds: 120,
    async handle() {
      if (!ctx.database) return;
      const result = await sweepJobs(ctx.database);
      for (const outcome of result.outcomes) {
        if (outcome.finished) {
          await services.hooks.emitFinished({ runId: outcome.runId, state: outcome.state });
        }
      }
    },
  });
}
