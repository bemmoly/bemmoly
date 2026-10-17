import type { JobDefinition } from '@bemmoly/core';
import { z } from 'zod';
import { repositoryInputSchema } from '../../../shared/catalog-writes.ts';
import { DISCOVERY_JOB, type DiscoveryService } from '../services/discovery/index.ts';

const discoveryPayloadSchema = z.object({ repository: repositoryInputSchema });

/**
 * pipelines.discover-repository: one repository's scan, enqueued when the code host is
 * installed, on repository events and nightly, keyed by repository so a burst of events
 * scans once. Thin: the service does the work.
 */
export function discoveryJob(discovery: Pick<DiscoveryService, 'discover'>): JobDefinition {
  return {
    name: DISCOVERY_JOB,
    retryLimit: 3,
    concurrency: 2,
    handle: async (payload) => {
      await discovery.discover(discoveryPayloadSchema.parse(payload).repository);
    },
  };
}
