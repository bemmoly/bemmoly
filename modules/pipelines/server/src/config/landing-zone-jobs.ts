import type { JobDefinition } from '@bemmoly/core';
import { z } from 'zod';
import {
  LANDING_ZONE_APPLY_JOB,
  LANDING_ZONE_DRIFT_JOB,
  type CloudsService,
} from '../services/clouds/index.ts';

const applyPayloadSchema = z.object({ planId: z.uuid() });

/**
 * pipelines.landing-zone-apply: works through a plan queued by POST /clouds/:id/apply.
 * Enqueued with an idempotency key of plan, spec hash and attempt, so one Apply runs once; a
 * retry skips every resource already ready at its hash and redoes only what failed. Cloud
 * calls can take minutes (projects, API enablement), hence the long expiry.
 */
export function landingZoneApplyJob(clouds: Pick<CloudsService, 'runApply'>): JobDefinition {
  return {
    name: LANDING_ZONE_APPLY_JOB,
    retryLimit: 3,
    retryDelaySeconds: 30,
    expireInSeconds: 60 * 60,
    handle: async (payload) => {
      await clouds.runApply(applyPayloadSchema.parse(payload).planId);
    },
  };
}

/**
 * pipelines.landing-zone-drift: re-reads every applied resource nightly and marks what no
 * longer matches. Scheduled and singleton, so one replica scans at a time (leader-only work,
 * architecture §19); a repeat run only re-reads.
 */
export function landingZoneDriftJob(clouds: Pick<CloudsService, 'scanDrift'>): JobDefinition {
  return {
    name: LANDING_ZONE_DRIFT_JOB,
    schedule: '23 2 * * *',
    singleton: true,
    retryLimit: 1,
    expireInSeconds: 60 * 60,
    handle: async () => {
      await clouds.scanDrift();
    },
  };
}
