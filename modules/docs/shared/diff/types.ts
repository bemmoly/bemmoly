import { z } from 'zod';

/*
 * The shape of a structural diff between two ProseMirror documents, as
 * GET /api/v1/docs/pages/:pageId/revisions/compare returns it. Blocks are
 * compared as blocks: a paragraph that moved is one "move", not a deletion
 * and an insertion; a paragraph that changed carries its inline changes; a
 * container (a list, a table, a callout) that changed carries its children's
 * diff, so one edited table cell shows as that cell.
 */

/** A ProseMirror mark: bold, a link with its href, and so on. */
export interface DiffMark {
  type: string;
  attrs?: Record<string, unknown>;
}

/** Any ProseMirror node as JSON. */
export interface DiffNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DiffNode[];
  text?: string;
  marks?: DiffMark[];
}

export const pmMarkSchema = z.object({ type: z.string() }).passthrough();
export const pmNodeSchema = z.object({ type: z.string() }).passthrough();

export const INLINE_OPS = ['equal', 'insert', 'delete', 'format'] as const;

/**
 * One run of inline content. Text runs carry `text`; an inline node (a
 * mention, a page link, a hard break) carries `node`. A "format" run is the
 * same text whose marks changed from `beforeMarks` to `marks`.
 */
export interface InlinePart {
  op: (typeof INLINE_OPS)[number];
  text?: string;
  node?: DiffNode;
  marks: DiffMark[];
  beforeMarks?: DiffMark[];
}

export const inlinePartSchema = z.object({
  op: z.enum(INLINE_OPS),
  text: z.string().optional(),
  node: pmNodeSchema.optional(),
  marks: z.array(pmMarkSchema),
  beforeMarks: z.array(pmMarkSchema).optional(),
}) as unknown as z.ZodType<InlinePart>;

export const BLOCK_OPS = ['equal', 'insert', 'delete', 'change', 'move', 'move_source'] as const;

export const attrChangeSchema = z.object({ before: z.unknown(), after: z.unknown() });

/**
 * One block in reading order. `move` sits where the block is now and names
 * where it came from (`oldIndex`); `move_source` marks the place it left, so
 * the history view can draw both ends. Indexes are positions among the
 * parent's children in the older (`oldIndex`) and newer (`newIndex`) document.
 */
export interface BlockDiff {
  op: (typeof BLOCK_OPS)[number];
  type: string;
  oldIndex: number | null;
  newIndex: number | null;
  /** The block as it was; absent on equal and insert. */
  before?: DiffNode;
  /** The block as it is; absent on delete and move_source. */
  after?: DiffNode;
  /** Attributes that changed (a heading's level, a callout's tone). */
  attrs?: Record<string, { before: unknown; after: unknown }>;
  /** A changed text block's runs. */
  inline?: InlinePart[];
  /** A changed container's children. */
  children?: BlockDiff[];
}

export const blockDiffSchema: z.ZodType<BlockDiff> = z.lazy(() =>
  z.object({
    op: z.enum(BLOCK_OPS),
    type: z.string(),
    oldIndex: z.number().int().nullable(),
    newIndex: z.number().int().nullable(),
    before: pmNodeSchema.optional(),
    after: pmNodeSchema.optional(),
    attrs: z.record(z.string(), attrChangeSchema).optional(),
    inline: z.array(inlinePartSchema).optional(),
    children: z.array(blockDiffSchema).optional(),
  }),
) as z.ZodType<BlockDiff>;

export const diffStatsSchema = z.object({
  inserted: z.number().int().nonnegative(),
  deleted: z.number().int().nonnegative(),
  changed: z.number().int().nonnegative(),
  moved: z.number().int().nonnegative(),
});

export const docDiffSchema = z.object({
  blocks: z.array(blockDiffSchema),
  stats: diffStatsSchema,
});

export type DiffStats = z.infer<typeof diffStatsSchema>;
export type DocDiff = { blocks: BlockDiff[]; stats: DiffStats };
