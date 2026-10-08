import { keysetPageSchema, keysetQuerySchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { richTextSchema } from './common.ts';

export const COMMENT_TARGET_KINDS = ['issue'] as const;

export const commentTargetKindSchema = z.enum(COMMENT_TARGET_KINDS);

/** Emoji shortcode to the ids of the people who reacted. */
export const reactionsSchema = z.record(z.string().min(1).max(60), z.array(z.uuid()));

export const commentSchema = z.object({
  id: z.uuid(),
  targetKind: commentTargetKindSchema,
  targetId: z.uuid(),
  parentId: z.uuid().nullable(),
  authorId: z.uuid().nullable(),
  body: richTextSchema,
  bodyText: z.string(),
  reactions: reactionsSchema,
  /** Set when the AI drafted the comment, so the accent and the audit trail follow it. */
  aiRunId: z.uuid().nullable(),
  editedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createCommentBodySchema = z.object({
  body: richTextSchema,
  parentId: z.uuid().optional(),
});

export const updateCommentBodySchema = z.object({ body: richTextSchema });

export const reactToCommentBodySchema = z.object({
  reaction: z.string().trim().min(1).max(60),
  /** False removes the actor's reaction. */
  on: z.boolean().default(true),
});

export const listCommentsQuerySchema = keysetQuerySchema;

export const commentsPageSchema = keysetPageSchema(commentSchema);

export type CommentTargetKind = z.infer<typeof commentTargetKindSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type CreateCommentBody = z.infer<typeof createCommentBodySchema>;
export type UpdateCommentBody = z.infer<typeof updateCommentBodySchema>;
export type ReactToCommentBody = z.input<typeof reactToCommentBodySchema>;
export type CommentsPage = z.infer<typeof commentsPageSchema>;
