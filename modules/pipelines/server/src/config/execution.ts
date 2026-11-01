import type { ModuleContext } from '@bemmoly/core';
import { z } from 'zod';
import { sweepJobs } from '../services/dispatcher/sweep.ts';
import { expireLogs } from '../services/logs/retention.ts';
import { MACHINES_START_JOB, MACHINES_SWEEP_JOB } from '../services/machines/index.ts';
import { RELEASE_FROM_RUN_JOB } from '../services/runs/release.ts';
import { REPORT_CHECK_JOB } from '../services/runs/checks.ts';
import type { PipelinesServices } from '../services/index.ts';

/*
 * The background work running pipelines needs: releases from passing builds, due schedules
 * every minute, a sweep for lost runners and timeouts in case no runner is claiming on any
 * replica to piggyback on, and the build machines sweep, with a quick start whenever a job
 * becomes ready in a pool whose machines Pipelines starts.
 */

export const SCHEDULES_JOB = 'pipelines.schedules';
export const DISPATCH_SWEEP_JOB = 'pipelines.dispatch-sweep';
export const LOG_RETENTION_JOB = 'pipelines.logs-retention';

const runPayload = z.object({ runId: z.uuid() });
const poolPayload = z.object({ poolId: z.uuid() });
const jobPayload = z.object({ jobId: z.uuid() });
/** A job's check, or the one check of a run that could not start. */
const checkPayload = z.union([jobPayload, runPayload]);

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
      const target = checkPayload.parse(payload);
      if ('jobId' in target) await services.reportCheck(target.jobId);
      else await services.reportRunCheck(target.runId);
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
    name: LOG_RETENTION_JOB,
    schedule: '15 3 * * *',
    singleton: true,
    expireInSeconds: 3600,
    async handle() {
      if (!ctx.database) return;
      const days = await ctx.settings.get('pipelines.logs.retentionDays');
      await expireLogs(ctx.database, ctx.objects, days);
    },
  });
  ctx.jobs.add({
    name: MACHINES_SWEEP_JOB,
    schedule: '* * * * *',
    singleton: true,
    retryLimit: 0,
    expireInSeconds: 300,
    async handle() {
      if (ctx.database) await services.machines.sweep();
    },
  });
  ctx.jobs.add({
    name: MACHINES_START_JOB,
    concurrency: 2,
    retryLimit: 0,
    expireInSeconds: 300,
    async handle(payload) {
      if (ctx.database)
        await services.machines.sweep({ pools: [poolPayload.parse(payload).poolId] });
    },
  });
  // A failed quick start costs at most a minute: the minute sweep starts the machine then.
  services.wakeups.subscribe((poolId) => void services.machines.kick(poolId).catch(() => {}));
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
