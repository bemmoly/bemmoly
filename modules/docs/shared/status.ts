import { z } from 'zod';
import { pageStatusSchema, type PageStatus } from './common.ts';

/*
 * Review flow: PUT /api/v1/docs/pages/:pageId/status and
 * PUT /api/v1/docs/pages/:pageId/reviewers. Publishing and archiving need
 * docs.page.publish; moving between draft and in review needs docs.page.edit.
 */

export const setStatusBodySchema = z.object({
  status: pageStatusSchema,
  /** Optional note recorded in the audit log ("ready for review"). */
  note: z.string().trim().max(500).optional(),
});

export const setReviewersBodySchema = z.object({
  reviewers: z.array(z.uuid()).max(20),
});

/** Which status changes are allowed; any status can go back to draft. */
export const STATUS_TRANSITIONS: Readonly<Record<PageStatus, readonly PageStatus[]>> = {
  draft: ['in_review', 'published', 'archived'],
  in_review: ['draft', 'published', 'archived'],
  published: ['draft', 'in_review', 'archived'],
  archived: ['draft', 'published'],
};

/** Statuses that need docs.page.publish to enter. */
export const PUBLISHING_STATUSES: readonly PageStatus[] = ['published', 'archived'];

export function canTransition(from: PageStatus, to: PageStatus): boolean {
  return from === to || STATUS_TRANSITIONS[from].includes(to);
}

export type SetStatusBody = z.infer<typeof setStatusBodySchema>;
export type SetReviewersBody = z.infer<typeof setReviewersBodySchema>;
