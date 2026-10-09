import { keysetPageSchema, keysetQuerySchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { issueKeySchema, queryFlagSchema, richTextSchema, slugKeySchema } from './common.ts';
import {
  issueLinkKindSchema,
  issuePrioritySchema,
  issueTypeLevelSchema,
  sprintStateSchema,
  statusCategorySchema,
} from './enums.ts';
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

/**
 * Partial by design; writes accept If-Match so two editors get a 409, not a
 * silent overwrite. A statusId is a transition: the workflow decides whether
 * the actor may make it, the issue service only records the result.
 */
export const updateIssueBodySchema = issueFieldsSchema
  .extend({ typeId: z.uuid(), statusId: z.uuid() })
  .partial();

const refSchema = z.object({ id: z.uuid(), name: z.string() });

const userRefSchema = z.object({ id: z.uuid(), name: z.string(), email: z.string() });

const issueRefSchema = z.object({
  id: z.uuid(),
  key: issueKeySchema,
  title: z.string(),
  statusId: z.uuid(),
  typeId: z.uuid(),
});

/** One row of the Linked issues section, read from the other issue's side. */
export const issueLinkViewSchema = z.object({
  id: z.uuid(),
  kind: issueLinkKindSchema,
  /** True when this issue is the target: shown as "blocked by", "duplicated by". */
  inverse: z.boolean(),
  issue: issueRefSchema,
});

/**
 * The Issue page in one response: the issue and the names the mock prints
 * beside each field, so the page never resolves ids one request at a time.
 */
export const issueDetailSchema = issueSchema.extend({
  type: refSchema.extend({
    key: slugKeySchema,
    level: issueTypeLevelSchema,
    icon: z.string().nullable(),
  }),
  status: refSchema.extend({ category: statusCategorySchema, color: z.string().nullable() }),
  assignee: userRefSchema.nullable(),
  reporter: userRefSchema.nullable(),
  parent: issueRefSchema.nullable(),
  sprint: refSchema.extend({ state: sprintStateSchema }).nullable(),
  fixVersion: refSchema.nullable(),
  labels: z.array(refSchema.extend({ color: z.string().nullable() })),
  links: z.array(issueLinkViewSchema),
  subtasks: z.array(issueRefSchema),
  watchersCount: z.number().int().nonnegative(),
  /** True when the actor watches it; drives the Watch toggle on the page. */
  watching: z.boolean(),
});

export const ISSUE_SORT_FIELDS = ['created', 'updated', 'priority', 'rank', 'due'] as const;

export const issueSortSchema = z.enum(ISSUE_SORT_FIELDS);

export const listIssuesQuerySchema = keysetQuerySchema.extend({
  /** An LQL query; ORDER BY inside it wins over `sort`. */
  q: z.string().trim().max(4000).optional(),
  projectId: z.uuid().optional(),
  sprintId: z.uuid().optional(),
  /** "none" lists the backlog: issues in no sprint. */
  sprint: z.literal('none').optional(),
  statusId: z.uuid().optional(),
  assigneeId: z.uuid().optional(),
  typeId: z.uuid().optional(),
  parentId: z.uuid().optional(),
  sort: issueSortSchema.default('rank'),
  order: z.enum(['asc', 'desc']).default('asc'),
  deleted: queryFlagSchema.default(false),
});

/** Where a dragged issue lands: between its new neighbours, either of which may be absent. */
export const rankIssueBodySchema = z
  .object({
    /** The row that ends up above the issue (the smaller rank); null at the top. */
    beforeIssueId: z.uuid().nullable().default(null),
    /** The row that ends up below the issue (the larger rank); null at the end. */
    afterIssueId: z.uuid().nullable().default(null),
    sprintId: z.uuid().nullable().optional(),
  })
  .refine((body) => body.beforeIssueId !== body.afterIssueId || body.beforeIssueId === null, {
    message: 'An issue cannot be dropped beside itself twice',
  });

export const watchIssueBodySchema = z.object({ watching: z.boolean() });

export const assignIssueBodySchema = z.object({ assigneeId: z.uuid().nullable() });

export const issuesPageSchema = keysetPageSchema(issueSchema);

export type Issue = z.infer<typeof issueSchema>;
export type CreateIssueBody = z.input<typeof createIssueBodySchema>;
export type UpdateIssueBody = z.infer<typeof updateIssueBodySchema>;
export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;
export type IssueSort = z.infer<typeof issueSortSchema>;
export type RankIssueBody = z.input<typeof rankIssueBodySchema>;
export type WatchIssueBody = z.infer<typeof watchIssueBodySchema>;
export type AssignIssueBody = z.infer<typeof assignIssueBodySchema>;
export type IssueDetail = z.infer<typeof issueDetailSchema>;
export type IssueLinkView = z.infer<typeof issueLinkViewSchema>;
export type IssuesPage = z.infer<typeof issuesPageSchema>;
