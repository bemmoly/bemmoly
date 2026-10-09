import { keysetPageSchema, keysetQuerySchema, listSchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';

/*
 * What happens around an issue: field history, time logged, who watches it
 * and what is attached to it.
 */

export const issueHistoryEntrySchema = z.object({
  id: z.uuid(),
  issueId: z.uuid(),
  actorId: z.uuid().nullable(),
  field: z.string(),
  from: z.unknown().nullable(),
  to: z.unknown().nullable(),
  aiPlanId: z.uuid().nullable(),
  createdAt: timestampSchema,
});

export const listIssueHistoryQuerySchema = keysetQuerySchema.extend({
  field: z.string().trim().min(1).max(60).optional(),
});

export const issueHistoryPageSchema = keysetPageSchema(issueHistoryEntrySchema);

export const workLogSchema = z.object({
  id: z.uuid(),
  issueId: z.uuid(),
  userId: z.uuid(),
  minutes: z.number().int().positive(),
  startedAt: timestampSchema,
  note: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createWorkLogBodySchema = z.object({
  minutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60 * 31),
  startedAt: timestampSchema.optional(),
  note: z.string().trim().max(1000).optional(),
});

export const updateWorkLogBodySchema = z
  .object({
    minutes: z
      .number()
      .int()
      .positive()
      .max(24 * 60 * 31),
    startedAt: timestampSchema,
    note: z.string().trim().max(1000).nullable(),
  })
  .partial();

export const WATCHER_TARGET_KINDS = ['issue'] as const;

export const watcherSchema = z.object({
  id: z.uuid(),
  targetKind: z.enum(WATCHER_TARGET_KINDS),
  targetId: z.uuid(),
  userId: z.uuid(),
  createdAt: timestampSchema,
});

export const ATTACHMENT_TARGET_KINDS = ['issue', 'comment'] as const;

export const attachmentSchema = z.object({
  id: z.uuid(),
  targetKind: z.enum(ATTACHMENT_TARGET_KINDS),
  targetId: z.uuid(),
  filename: z.string(),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  uploadedBy: z.uuid().nullable(),
  createdAt: timestampSchema,
});

/** The upload itself goes through the kernel object store; this names what was stored. */
export const createAttachmentBodySchema = z.object({
  storageKey: z.string().trim().min(1).max(512),
  filename: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

export const workLogsResponseSchema = listSchema(workLogSchema);
export const watchersResponseSchema = listSchema(watcherSchema);
export const attachmentsResponseSchema = listSchema(attachmentSchema);

export type IssueHistoryEntry = z.infer<typeof issueHistoryEntrySchema>;
export type ListIssueHistoryQuery = z.infer<typeof listIssueHistoryQuerySchema>;
export type IssueHistoryPage = z.infer<typeof issueHistoryPageSchema>;
export type WorkLog = z.infer<typeof workLogSchema>;
export type CreateWorkLogBody = z.infer<typeof createWorkLogBodySchema>;
export type UpdateWorkLogBody = z.infer<typeof updateWorkLogBodySchema>;
export type Watcher = z.infer<typeof watcherSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type CreateAttachmentBody = z.infer<typeof createAttachmentBodySchema>;
