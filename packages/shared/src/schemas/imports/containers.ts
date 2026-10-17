import { z } from 'zod';
import { importTargetSchema } from './options.ts';

/*
 * Choosing what to bring in: the projects or spaces a connection found, listed a page at a
 * time with search and filters, counted on demand, and picked through a selection the server
 * keeps. A selection is a list of operations replayed in order (tick these, untick all that
 * match a search, clear, put back what was cleared), so ticking 1,240 projects sends one
 * operation, not 1,240 ids, and the client can apply the same operations to the rows it shows.
 */

/** `attention`: chosen rows whose target wants a look (an error, an existing target, an update, a new key). */
export const IMPORT_CONTAINER_FILTERS = [
  'all',
  'new',
  'imported',
  'noaccess',
  'selected',
  'attention',
  /** Chosen rows whose run failed, and the rest of the chosen: the run lists, failed first. */
  'failed',
  'others',
] as const;
export const importContainerFilterSchema = z.enum(IMPORT_CONTAINER_FILTERS);
export type ImportContainerFilter = z.infer<typeof importContainerFilterSchema>;

export const IMPORT_CONTAINER_ACCESS = ['ok', 'none'] as const;
export const importContainerAccessSchema = z.enum(IMPORT_CONTAINER_ACCESS);

/** What an earlier import of the same site made from this container. */
export const importedTargetSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
  at: z.iso.datetime(),
});

/** One project, space or file as the chooser lists it. */
export const importContainerRowSchema = z.object({
  id: z.string(),
  key: z.string().nullable(),
  name: z.string(),
  kind: z.string(),
  /** "Software", "Business", "Service"; "Team" or "Personal" for spaces. */
  type: z.string().nullable(),
  lead: z.string().nullable(),
  /** "none": listed, but the token cannot read what is inside; never selectable. */
  access: importContainerAccessSchema,
  /** Records inside it; null until counted. */
  count: z.number().int().nonnegative().nullable(),
  imported: importedTargetSchema.nullable(),
  /** A project or space here already uses the key it would get. */
  keyInUse: z.boolean(),
  selected: z.boolean(),
  /** How its run went; null before it runs. */
  progress: z
    .object({
      status: z.enum(['waiting', 'running', 'done', 'failed']),
      phase: z.string().nullable(),
      done: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
      /** Why it stopped, in plain words; where it stopped is done of total. */
      error: z.string().nullable(),
      /** What it made, by kind, and where to open it. */
      counts: z.record(
        z.string(),
        z.object({
          created: z.number().int().nonnegative(),
          updated: z.number().int().nonnegative(),
          skipped: z.number().int().nonnegative(),
        }),
      ),
      /** The app path of what it went into: "/work/board/PLT". */
      path: z.string().nullable(),
    })
    .nullable()
    .optional(),
  /** Where it goes, once a plan has been made with it chosen. */
  target: importTargetSchema.nullable().optional(),
});

export const importContainerQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  filter: importContainerFilterSchema.default('all'),
  cursor: z
    .string()
    .regex(/^\d{1,9}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const importContainerCountsSchema = z.object({
  all: z.number().int().nonnegative(),
  new: z.number().int().nonnegative(),
  imported: z.number().int().nonnegative(),
  noaccess: z.number().int().nonnegative(),
  selected: z.number().int().nonnegative(),
  /** Chosen rows whose target wants a look; zero before a plan. */
  attention: z.number().int().nonnegative(),
});

export const importContainerPageSchema = z.object({
  items: z.array(importContainerRowSchema),
  next: z.string().nullable(),
  /** The rows matching this search and filter: all of them, the selectable ones, the ticked ones. */
  view: z.object({
    total: z.number().int().nonnegative(),
    selectable: z.number().int().nonnegative(),
    selected: z.number().int().nonnegative(),
  }),
  /** How many rows each filter shows, for the filter buttons. */
  counts: importContainerCountsSchema,
});

/** POST /admin/imports/:id/containers/counts: count these now (rows coming into view). */
export const importCountBodySchema = z
  .object({ ids: z.array(z.string().min(1).max(200)).min(1).max(100) })
  .strict();

export const importCountListSchema = z.object({
  items: z.array(z.object({ id: z.string(), count: z.number().int().nonnegative() })),
});

export const importSelectionScopeSchema = z
  .object({ q: z.string().trim().max(100).optional(), filter: importContainerFilterSchema })
  .strict();

export const importSelectionOpSchema = z.union([
  z
    .object({ select: z.boolean(), ids: z.array(z.string().min(1).max(200)).min(1).max(1000) })
    .strict(),
  z.object({ select: z.boolean(), scope: importSelectionScopeSchema }).strict(),
  /** Unticks everything and remembers what was ticked, for Undo. */
  z.object({ clear: z.literal(true) }).strict(),
  /** Puts back what the last clear removed. */
  z.object({ restore: z.literal(true) }).strict(),
]);

export const importSelectionBodySchema = z
  .object({ ops: z.array(importSelectionOpSchema).min(1).max(200) })
  .strict();

/** The running total under the chooser. */
export const importSelectionSummarySchema = z.object({
  selected: z.number().int().nonnegative(),
  /** Records in the ticked rows that are counted. */
  records: z.number().int().nonnegative(),
  /** Ticked rows not counted yet; the total is approximate while this is above zero. */
  uncounted: z.number().int().nonnegative(),
});

export type ImportedTarget = z.infer<typeof importedTargetSchema>;
export type ImportContainerRow = z.infer<typeof importContainerRowSchema>;
export type ImportContainerQuery = z.infer<typeof importContainerQuerySchema>;
export type ImportContainerPage = z.infer<typeof importContainerPageSchema>;
export type ImportContainerCounts = z.infer<typeof importContainerCountsSchema>;
export type ImportCountBody = z.infer<typeof importCountBodySchema>;
export type ImportCountList = z.infer<typeof importCountListSchema>;
export type ImportSelectionScope = z.infer<typeof importSelectionScopeSchema>;
export type ImportSelectionOp = z.infer<typeof importSelectionOpSchema>;
export type ImportSelectionBody = z.infer<typeof importSelectionBodySchema>;
export type ImportSelectionSummary = z.infer<typeof importSelectionSummarySchema>;

/** Whether a row falls in a search and filter, the same test the server's SQL makes. */
export function matchesScope(
  row: Pick<ImportContainerRow, 'key' | 'name' | 'lead' | 'access' | 'imported' | 'selected'> &
    Partial<Pick<ImportContainerRow, 'target' | 'progress'>>,
  scope: ImportSelectionScope,
): boolean {
  const q = scope.q?.trim().toLowerCase();
  if (q) {
    const hay = [row.key ?? '', row.name, row.lead ?? ''].map((part) => part.toLowerCase());
    if (!hay.some((part) => part.includes(q))) return false;
  }
  switch (scope.filter) {
    case 'new':
      return row.imported === null && row.access === 'ok';
    case 'imported':
      return row.imported !== null;
    case 'noaccess':
      return row.access === 'none';
    case 'selected':
      return row.selected;
    case 'failed':
      return row.selected && row.progress?.status === 'failed';
    case 'others':
      return row.selected && row.progress?.status !== 'failed';
    case 'attention':
      return (
        row.selected &&
        row.target != null &&
        (row.target.error !== null || row.target.mode !== 'create' || row.target.key !== row.key)
      );
    default:
      return true;
  }
}

/**
 * A row's tick after the operations, in order; the server applies the same ones. A row the
 * token cannot read is never ticked. Restore needs what the server remembered, so a row it
 * touches keeps `before` (the tick it had before the clear).
 */
export function applySelection(
  row: Pick<
    ImportContainerRow,
    'id' | 'key' | 'name' | 'lead' | 'access' | 'imported' | 'selected'
  >,
  ops: readonly ImportSelectionOp[],
  before?: boolean,
): boolean {
  if (row.access === 'none') return false;
  let selected = row.selected;
  for (const op of ops) {
    if ('clear' in op) selected = false;
    else if ('restore' in op) selected = before ?? selected;
    else if ('ids' in op) {
      if (op.ids.includes(row.id)) selected = op.select;
    } else if (matchesScope({ ...row, selected }, op.scope)) selected = op.select;
  }
  return selected;
}
