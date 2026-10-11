import { z } from 'zod';

/*
 * Settings › Import and the setup wizard's import step: the sources enabled modules offer,
 * an import job from connection to report, and the bodies that move it along. Secrets are
 * write-only: a job says which secret fields were given, never what they hold.
 */

export const IMPORT_SOURCE_ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
export const importSourceIdSchema = z.string().regex(IMPORT_SOURCE_ID_PATTERN);

/** Largest file a file-based source (CSV) takes in one request. */
export const IMPORT_FILE_MAX_BYTES = 10 * 1024 * 1024;

export const IMPORT_FIELD_KINDS = ['url', 'text', 'email', 'secret', 'select', 'file'] as const;

/** One field of a source's connection form, drawn by the UI from this description. */
export const importFieldSchema = z.object({
  name: z.string().regex(/^[a-z][a-zA-Z0-9]{0,39}$/),
  label: z.string(),
  kind: z.enum(IMPORT_FIELD_KINDS),
  required: z.boolean(),
  help: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  /** Shown only while another field holds one of these values. */
  showWhen: z.object({ field: z.string(), values: z.array(z.string()) }).optional(),
});

export const importSourceSchema = z.object({
  id: importSourceIdSchema,
  moduleId: z.string(),
  label: z.string(),
  description: z.string(),
  /** What it brings in, in the order the run does it: "Projects", "Issues". */
  brings: z.array(z.string()),
  fields: z.array(importFieldSchema),
});

export const importSourceListSchema = z.object({ items: z.array(importSourceSchema) });

export const IMPORT_JOB_STATUSES = [
  'ready',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;
export const importJobStatusSchema = z.enum(IMPORT_JOB_STATUSES);
export type ImportJobStatus = z.infer<typeof importJobStatusSchema>;

/** A project, space or file the source holds, picked or left out before the run. */
export const importContainerSchema = z.object({
  id: z.string(),
  key: z.string().nullable(),
  name: z.string(),
  kind: z.string(),
  /** Records inside it, when the source can count them cheaply. */
  count: z.number().int().nonnegative().nullable(),
});

export const importDiscoverySchema = z.object({
  /** The site, as the person will recognise it: "acme.example.net". */
  site: z.string(),
  containers: z.array(importContainerSchema),
  /** Totals across the site: { issues: 10432, users: 88 }. */
  counts: z.record(z.string(), z.number().int().nonnegative()),
  warnings: z.array(z.string()),
});

export const IMPORT_MAPPING_ACTIONS = ['match', 'create', 'report'] as const;

/** How one thing at the source lands: matched to what exists, created, or only reported. */
export const importMappingSchema = z.object({
  kind: z.string(),
  source: z.string(),
  action: z.enum(IMPORT_MAPPING_ACTIONS),
  target: z.string().nullable(),
  note: z.string().nullable(),
});

export const importPlanSchema = z.object({
  containers: z.array(z.string()),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  mappings: z.array(importMappingSchema),
});

export const importCountSchema = z.object({
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});

export const importSkipSchema = z.object({
  kind: z.string(),
  source: z.string(),
  reason: z.string(),
});

export const importReportSchema = z.object({
  counts: z.record(z.string(), importCountSchema),
  /** The first skipped records, with why; skippedTotal says how many there were. */
  skipped: z.array(importSkipSchema),
  skippedTotal: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
});

export const importJobSchema = z.object({
  id: z.uuid(),
  source: importSourceIdSchema,
  sourceLabel: z.string(),
  status: importJobStatusSchema,
  /** The step running now: "Issues". */
  phase: z.string().nullable(),
  progress: z.object({
    done: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  /** The connection's plain fields; a secret field appears here as true once given. */
  connection: z.record(z.string(), z.union([z.string(), z.boolean()])),
  discovery: importDiscoverySchema.nullable(),
  plan: importPlanSchema.nullable(),
  report: importReportSchema,
  error: z.string().nullable(),
  /** How many times it has run; a re-run updates what an earlier one made. */
  runs: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
});

export const importJobListSchema = z.object({ items: z.array(importJobSchema) });

export const importJobIdParamsSchema = z.object({ id: z.uuid() });

/** POST /admin/imports: connect to a source and look at what it holds. */
export const createImportBodySchema = z
  .object({
    source: importSourceIdSchema,
    values: z.record(z.string(), z.string().max(IMPORT_FILE_MAX_BYTES)),
  })
  .strict();

/** PATCH /admin/imports/:id: what to bring in; answers with the plan. */
export const updateImportBodySchema = z
  .object({ containers: z.array(z.string().min(1).max(200)).min(1).max(500) })
  .strict();

export type ImportField = z.infer<typeof importFieldSchema>;
export type ImportSource = z.infer<typeof importSourceSchema>;
export type ImportContainer = z.infer<typeof importContainerSchema>;
export type ImportDiscovery = z.infer<typeof importDiscoverySchema>;
export type ImportMapping = z.infer<typeof importMappingSchema>;
export type ImportPlan = z.infer<typeof importPlanSchema>;
export type ImportCount = z.infer<typeof importCountSchema>;
export type ImportSkip = z.infer<typeof importSkipSchema>;
export type ImportReport = z.infer<typeof importReportSchema>;
export type ImportJob = z.infer<typeof importJobSchema>;
export type CreateImportBody = z.infer<typeof createImportBodySchema>;
export type UpdateImportBody = z.infer<typeof updateImportBodySchema>;
