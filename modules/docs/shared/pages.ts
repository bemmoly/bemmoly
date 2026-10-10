import { keysetPageSchema, keysetQuerySchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import {
  docsPersonSchema,
  iconSchema,
  pageStatusSchema,
  pageTitleSchema,
  queryFlagSchema,
  richTextSchema,
  spaceKeySchema,
} from './common.ts';
import { lexorankSchema } from './lexorank.ts';

/*
 * Pages: POST /api/v1/docs/pages, GET/PATCH/DELETE /api/v1/docs/pages/:pageId,
 * POST /api/v1/docs/pages/:pageId/restore, GET /api/v1/docs/spaces/:spaceKey/trash.
 * A page summary is what trees, lists and the palette show; the detail adds
 * the document. Delete is soft: the page and its subtree go to the trash.
 */

export const pageSummarySchema = z.object({
  id: z.uuid(),
  spaceId: z.uuid(),
  spaceKey: spaceKeySchema,
  parentId: z.uuid().nullable(),
  position: lexorankSchema,
  /** 0 for a root page. */
  depth: z.number().int().nonnegative(),
  title: z.string(),
  icon: z.string().nullable(),
  status: pageStatusSchema,
  ownerId: z.uuid().nullable(),
  hasChildren: z.boolean(),
  wordCount: z.number().int().nonnegative(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.nullable(),
});

export const breadcrumbSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  icon: z.string().nullable(),
});

export const pageDetailSchema = pageSummarySchema.extend({
  snapshot: richTextSchema.nullable(),
  tldr: z.string().nullable(),
  reviewers: z.array(z.uuid()),
  templateId: z.uuid().nullable(),
  labels: z.array(z.string()),
  starred: z.boolean(),
  /** Bumped on every metadata write; PATCH may send it to refuse a stale edit. */
  version: z.number().int().positive(),
  breadcrumbs: z.array(breadcrumbSchema),
  owner: docsPersonSchema.nullable(),
  createdBy: z.uuid().nullable(),
  updatedBy: z.uuid().nullable(),
  publishedAt: timestampSchema.nullable(),
  contentUpdatedAt: timestampSchema,
});

export const createPageBodySchema = z.object({
  spaceId: z.uuid(),
  parentId: z.uuid().nullable().default(null),
  title: pageTitleSchema.default(''),
  icon: iconSchema.optional(),
  /** Without one the page starts empty; with one it starts from the template's snapshot. */
  templateId: z.uuid().optional(),
  snapshot: richTextSchema.optional(),
  /** Where among its siblings; the end when both are absent. */
  afterId: z.uuid().optional(),
  beforeId: z.uuid().optional(),
});

/**
 * Title, icon and owner; status goes through /status and the body through /collab.
 * `snapshot` is the 0.2 way to write a body: still accepted, applied through the collab
 * server as one edit, and removed in 0.4.
 */
export const updatePageBodySchema = z
  .object({
    title: pageTitleSchema,
    icon: iconSchema.nullable(),
    ownerId: z.uuid().nullable(),
    /** @deprecated Edit the body through /collab; accepted until 0.4. */
    snapshot: richTextSchema,
    version: z.number().int().positive(),
  })
  .partial();

export const listTrashQuerySchema = keysetQuerySchema;

/** Days a page stays in the trash before the purge job deletes it for good. */
export const TRASH_RETENTION_DAYS = 30;

export const trashPageParamsSchema = z.object({ spaceKey: z.string().min(1), pageId: z.uuid() });

export const emptyTrashResultSchema = z.object({ deleted: z.number().int().nonnegative() });
export type EmptyTrashResult = z.infer<typeof emptyTrashResultSchema>;

export const getPageQuerySchema = z.object({
  /** Include a page in the trash, for the restore banner. */
  deleted: queryFlagSchema.default(false),
});

export const pageSummaryPageSchema = keysetPageSchema(pageSummarySchema);

export type PageSummary = z.infer<typeof pageSummarySchema>;
export type Breadcrumb = z.infer<typeof breadcrumbSchema>;
export type PageDetail = z.infer<typeof pageDetailSchema>;
export type CreatePageBody = z.input<typeof createPageBodySchema>;
export type UpdatePageBody = z.infer<typeof updatePageBodySchema>;
export type ListTrashQuery = z.infer<typeof listTrashQuerySchema>;
export type PageSummaryPage = z.infer<typeof pageSummaryPageSchema>;
