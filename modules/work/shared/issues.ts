import { keysetPageSchema, keysetQuerySchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { issueKeySchema, richTextSchema } from './common.ts';
import { issuePrioritySchema } from './enums.ts';
import { lexorankSchema } from './lexorank.ts';

/*
 * The issue as the API presents it. Related rows (labels, links, comments,
 * history) have their own schemas and sub-resources; the card and the page
 * read only what the board config asks for.
 */

export const issueSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  number: z.number().int().positive(),
  key: issueKeySchema,
  typeId: z.uuid(),
  title: z.string(),
  description: richTextSchema.nullable(),
  descriptionText: z.string(),
  statusId: z.uuid(),
  priority: issuePrioritySchema,
  assigneeId: z.uuid().nullable(),
  reporterId: z.uuid().nullable(),
  /** The epic of a standard issue or the parent of a subtask. */
  parentId: z.uuid().nullable(),
  sprintId: z.uuid().nullable(),
  estimate: z.number().nonnegative().nullable(),
  dueAt: z.iso.date().nullable(),
  fixVersionId: z.uuid().nullable(),
  componentId: z.uuid().nullable(),
  customFields: z.record(z.string(), z.unknown()),
  labelIds: z.array(z.uuid()),
  rank: lexorankSchema,
  statusChangedAt: timestampSchema,
  resolvedAt: timestampSchema.nullable(),
  deletedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

const issueFieldsSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: richTextSchema.nullable(),
  priority: issuePrioritySchema,
  assigneeId: z.uuid().nullable(),
  parentId: z.uuid().nullable(),
  sprintId: z.uuid().nullable(),
  estimate: z.number().nonnegative().max(1_000_000).nullable(),
  dueAt: z.iso.date().nullable(),
  fixVersionId: z.uuid().nullable(),
  componentId: z.uuid().nullable(),
  customFields: z.record(z.string(), z.unknown()),
  labelIds: z.array(z.uuid()).max(50),
});

export const createIssueBodySchema = issueFieldsSchema.partial().extend({
  projectId: z.uuid(),
  typeId: z.uuid(),
  title: z.string().trim().min(1).max(500),
  priority: issuePrioritySchema.default('medium'),
});

/** Partial by design; writes accept If-Match so two editors get a 409, not a silent overwrite. */
export const updateIssueBodySchema = issueFieldsSchema.extend({ typeId: z.uuid() }).partial();

export const ISSUE_SORT_FIELDS = ['created', 'updated', 'priority', 'rank', 'due'] as const;

export const issueSortSchema = z.enum(ISSUE_SORT_FIELDS);

export const listIssuesQuerySchema = keysetQuerySchema.extend({
  /** An LQL query; ORDER BY inside it wins over `sort`. */
  q: z.string().trim().max(4000).optional(),
  projectId: z.uuid().optional(),
  sprintId: z.uuid().optional(),
  sort: issueSortSchema.default('rank'),
  order: z.enum(['asc', 'desc']).default('asc'),
  deleted: z.coerce.boolean().default(false),
});

/** Where a dragged issue lands: between its new neighbours, either of which may be absent. */
export const rankIssueBodySchema = z
  .object({
    beforeIssueId: z.uuid().nullable().default(null),
    afterIssueId: z.uuid().nullable().default(null),
    sprintId: z.uuid().nullable().optional(),
  })
  .refine((body) => body.beforeIssueId !== body.afterIssueId || body.beforeIssueId === null, {
    message: 'An issue cannot be dropped beside itself twice',
  });

export const watchIssueBodySchema = z.object({ watching: z.boolean() });

export const issuesPageSchema = keysetPageSchema(issueSchema);

export type Issue = z.infer<typeof issueSchema>;
export type CreateIssueBody = z.input<typeof createIssueBodySchema>;
export type UpdateIssueBody = z.infer<typeof updateIssueBodySchema>;
export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;
export type IssueSort = z.infer<typeof issueSortSchema>;
export type RankIssueBody = z.input<typeof rankIssueBodySchema>;
export type WatchIssueBody = z.infer<typeof watchIssueBodySchema>;
export type IssuesPage = z.infer<typeof issuesPageSchema>;
