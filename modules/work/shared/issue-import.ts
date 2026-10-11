import { timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { issuePrioritySchema } from './enums.ts';
import { projectKeySchema } from './projects.ts';

/*
 * Issues brought over from another tracker by an agent, in batches. The external key is the
 * idempotency key: sending the same one again updates the issue it made. Types and statuses
 * are named the way the source names them, or by id; people by email.
 */

/** How many issues one call may carry, so a call stays one bounded request. */
export const ISSUE_IMPORT_MAX = 200;

const externalKeySchema = z.string().trim().min(1).max(120);
const emailSchema = z.string().trim().toLowerCase().max(320).pipe(z.email());

export const importedCommentSchema = z.object({
  authorEmail: emailSchema.optional(),
  authorName: z.string().trim().min(1).max(200).optional(),
  createdAt: timestampSchema,
  bodyMarkdown: z.string().trim().min(1).max(50_000),
});

export const importedIssueSchema = z.object({
  externalKey: externalKeySchema,
  title: z.string().trim().min(1).max(500),
  descriptionMarkdown: z.string().max(100_000).optional(),
  /** The type's name in the project, or its id. */
  type: z.string().trim().min(1).max(120),
  /** The status's name in the project's workflow, or its id. */
  status: z.string().trim().min(1).max(120),
  priority: issuePrioritySchema.optional(),
  assigneeEmail: emailSchema.optional(),
  reporterEmail: emailSchema.optional(),
  labels: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  parentExternalKey: externalKeySchema.optional(),
  createdAt: timestampSchema.optional(),
  updatedAt: timestampSchema.optional(),
  resolvedAt: timestampSchema.optional(),
  comments: z.array(importedCommentSchema).max(200).optional(),
});

export const importIssuesBodySchema = z.object({
  projectKey: projectKeySchema,
  issues: z.array(importedIssueSchema).min(1).max(ISSUE_IMPORT_MAX),
});

export const importIssuesResultSchema = z.object({
  created: z.array(z.object({ externalKey: z.string(), key: z.string(), id: z.uuid() })),
  updated: z.array(z.object({ externalKey: z.string(), key: z.string(), id: z.uuid() })),
  skipped: z.array(z.object({ externalKey: z.string(), reason: z.string() })),
  /** What was written with a part left out: an unknown assignee, a parent not imported. */
  warnings: z.array(z.object({ externalKey: z.string(), message: z.string() })),
});

export type ImportedComment = z.infer<typeof importedCommentSchema>;
export type ImportedIssue = z.infer<typeof importedIssueSchema>;
export type ImportIssuesBody = z.infer<typeof importIssuesBodySchema>;
export type ImportIssuesResult = z.infer<typeof importIssuesResultSchema>;
