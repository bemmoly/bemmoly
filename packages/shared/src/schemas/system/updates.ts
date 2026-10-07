import { z } from 'zod';
import { releaseChangesetSchema, releaseChannelSchema, semverSchema } from './release-manifest.ts';

export const rollbackModeSchema = z.enum(['code', 'schema', 'restore']);

export const rollbackPlanSchema = z.object({
  fromVersion: z.string(),
  toVersion: z.string(),
  mode: rollbackModeSchema,
  /** One sentence the confirmation dialog shows, naming what is lost. */
  summary: z.string(),
  reason: z.string(),
  /** Changesets the schema mode runs `down` for, newest first. */
  schemaChangesets: z.array(z.object({ module: z.string(), id: z.string() })),
  /** Present for restore: what the audit log says will be discarded. */
  discard: z
    .object({
      changes: z.number().int().nonnegative(),
      people: z.number().int().nonnegative(),
      since: z.iso.datetime(),
    })
    .nullable(),
  backupId: z.string().nullable(),
  expiresAt: z.iso.datetime().nullable(),
});

export const availableUpdateSchema = z.object({
  version: semverSchema,
  publishedAt: z.iso.datetime(),
  notes: z.string(),
  notesUrl: z.url().optional(),
  slowChangesets: z.array(releaseChangesetSchema),
  irreversibleChangesets: z.array(releaseChangesetSchema),
  configChanges: z.array(z.string()),
});

export const updatesOverviewSchema = z.object({
  current: z.object({
    version: z.string(),
    channel: releaseChannelSchema,
    updatedAt: z.iso.datetime().nullable(),
    previousVersion: z.string().nullable(),
  }),
  checks: z.object({
    enabled: z.boolean(),
    lastCheckedAt: z.iso.datetime().nullable(),
    manifest: z.enum(['verified', 'unverified']).nullable(),
    error: z.string().nullable(),
  }),
  available: availableUpdateSchema.nullable(),
  rollback: rollbackPlanSchema.nullable(),
  /** `cli` when the install has no updater; the page shows `command` instead of a button. */
  updater: z.object({
    mode: z.enum(['in_app', 'cli']),
    command: z.string(),
    state: z.enum(['idle', 'running', 'failed', 'unreachable']),
    step: z.string().nullable(),
  }),
});

export const applyUpdateRequestSchema = z.object({ version: semverSchema });

export const rollbackRequestSchema = z.object({
  /** The mode the dialog showed; the request fails if the plan changed since. */
  expectedMode: rollbackModeSchema,
  /** Ask for a restore even when a code rollback would do. */
  preferRestore: z.boolean().default(false),
});

export const updaterAcceptedSchema = z.object({
  accepted: z.literal(true),
  operation: z.enum(['update', 'rollback']),
  target: z.string(),
});

export const catalogUploadQuerySchema = z.object({
  filename: z
    .string()
    .regex(
      /^bemmoly-airgap-[0-9A-Za-z.+-]+\.tar(\.gz)?$/,
      'must be a bemmoly-airgap-<version>.tar.gz bundle',
    ),
});

export const catalogUploadResponseSchema = z.object({
  filename: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string(),
  storedAt: z.iso.datetime(),
});

export type RollbackMode = z.infer<typeof rollbackModeSchema>;
export type RollbackPlan = z.infer<typeof rollbackPlanSchema>;
export type AvailableUpdate = z.infer<typeof availableUpdateSchema>;
export type UpdatesOverview = z.infer<typeof updatesOverviewSchema>;
export type ApplyUpdateRequest = z.infer<typeof applyUpdateRequestSchema>;
export type RollbackRequest = z.infer<typeof rollbackRequestSchema>;
export type UpdaterAccepted = z.infer<typeof updaterAcceptedSchema>;
export type CatalogUploadQuery = z.infer<typeof catalogUploadQuerySchema>;
export type CatalogUploadResponse = z.infer<typeof catalogUploadResponseSchema>;
