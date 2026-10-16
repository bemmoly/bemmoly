import type { ModuleContext } from '@bemmoly/core';
import { z } from 'zod';
import { sweepJobs } from '../services/dispatcher/sweep.ts';
import { RELEASE_FROM_RUN_JOB } from '../services/runs/release.ts';
import { REPORT_CHECK_JOB } from '../services/runs/checks.ts';
import type { PipelinesServices } from '../services/index.ts';

/*
 * The background work running pipelines needs: releases from passing builds, due schedules
 * every minute, and a sweep for lost runners and timeouts in case no runner is claiming on
 * any replica to piggyback on.
 */

export const SCHEDULES_JOB = 'pipelines.schedules';
export const DISPATCH_SWEEP_JOB = 'pipelines.dispatch-sweep';

const runPayload = z.object({ runId: z.uuid() });
const jobPayload = z.object({ jobId: z.uuid() });

export function registerExecutionWork(ctx: ModuleContext, services: PipelinesServices): void {
  ctx.jobs.add({
    name: RELEASE_FROM_RUN_JOB,
    retryLimit: 5,
    async handle(payload) {
      await services.releaseFrom(runPayload.parse(payload).runId);
    },
  });
  ctx.jobs.add({
    name: REPORT_CHECK_JOB,
    retryLimit: 5,
    retryDelaySeconds: 10,
    concurrency: 4,
    async handle(payload) {
      await services.reportCheck(jobPayload.parse(payload).jobId);
    },
  });
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
