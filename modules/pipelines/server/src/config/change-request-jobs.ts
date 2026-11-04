import type { JobDefinition } from '@bemmoly/core';
import type { ChangeRequestsService } from '../services/change-requests/index.ts';

/*
 * The change requests' minute sweep: an approved request whose chosen time or deploy window
 * has come starts its deploy, and one whose deploys all finished settles. A singleton, so two
 * replicas never start the same deploy; the start itself is claimed under a row lock too.
 */

export const CHANGE_REQUESTS_SWEEP_JOB = 'pipelines.change-requests-sweep';

export function changeRequestJobs(
  service: () => ChangeRequestsService | undefined,
): JobDefinition[] {
  return [
    {
      name: CHANGE_REQUESTS_SWEEP_JOB,
      schedule: '* * * * *',
      singleton: true,
      retryLimit: 0,
      expireInSeconds: 300,
      handle: async () => {
        await service()?.sweep();
      },
    },
  ];
}
