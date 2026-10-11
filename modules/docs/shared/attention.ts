import { timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { homePageSchema } from './home.ts';

/*
 * The Docs home's "Needs attention": GET /api/v1/docs/home/attention. What is
 * waiting on the person, worked out from the pages alone, so it needs no AI
 * and no other module: pages they were asked to review, and published pages
 * they own that nobody has edited for docs.staleAfterDays. With AI on for the
 * person, "consistency" adds their pages whose last consistency check found
 * the page contradicting an issue it names.
 */

export const ATTENTION_KINDS = ['review', 'stale', 'consistency'] as const;

export const attentionItemSchema = z.object({
  kind: z.enum(ATTENTION_KINDS),
  page: homePageSchema,
  /** Since when: the review request, the last edit of a stale page, or the check. */
  since: timestampSchema,
  /** How many contradictions the consistency check found; consistency items only. */
  findings: z.number().int().positive().optional(),
});

export const attentionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const attentionResponseSchema = z.object({
  items: z.array(attentionItemSchema),
  /** The setting the stale items were measured against. */
  staleAfterDays: z.number().int().positive(),
});

export type AttentionKind = (typeof ATTENTION_KINDS)[number];
export type AttentionItem = z.infer<typeof attentionItemSchema>;
export type AttentionQuery = z.infer<typeof attentionQuerySchema>;
export type AttentionResponse = z.infer<typeof attentionResponseSchema>;
