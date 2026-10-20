import { z } from 'zod';
import { repositoryInputSchema } from './catalog-writes.ts';
import { isoDateTimeSchema } from './common.ts';

/*
 * Discovery as setup sees it: a sweep asks the connected hosts which repositories Pipelines
 * may read and scans them; the status says how far it got, so step 2 can show progress.
 */

/** One repository, or none to sweep every repository the hosts let Pipelines read again. */
export const scanBodySchema = z.object({ repository: repositoryInputSchema.optional() });
export const sweepQueuedSchema = z.object({ queued: z.literal(true) });

export const discoverySweepSchema = z.object({
  startedAt: isoDateTimeSchema,
  finishedAt: isoDateTimeSchema.nullable(),
  /** How many repositories the hosts listed; null until it finished. */
  repositories: z.number().int().nullable(),
  /** Why the hosts could not be asked, in plain words. */
  error: z.string().nullable(),
});

export const discoveryStatusSchema = z.object({
  /** Repositories Pipelines knows of, archived ones left out. */
  repositories: z.number().int(),
  /** Scanned since a scan was last asked for. */
  scanned: z.number().int(),
  /** Whose last scan could not read the repository. */
  failed: z.number().int(),
  /** A sweep or a repository's scan has not finished yet. */
  scanning: z.boolean(),
  lastSweep: discoverySweepSchema.nullable(),
});

export type ScanBody = z.infer<typeof scanBodySchema>;
export type DiscoverySweep = z.infer<typeof discoverySweepSchema>;
export type DiscoveryStatus = z.infer<typeof discoveryStatusSchema>;
