import { listSchema } from '@bemmoly/shared';
import { z } from 'zod';

/*
 * Stars: PUT and DELETE /api/v1/docs/pages/:pageId/star (idempotent).
 * Labels: PUT /api/v1/docs/pages/:pageId/labels replaces the set;
 * GET /api/v1/docs/labels?q= suggests names already in use.
 */

export const labelNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[^\s,][^,]*$/, 'Labels cannot contain commas');

export const setLabelsBodySchema = z.object({
  labels: z.array(labelNameSchema).max(30),
});

export const labelsResponseSchema = z.object({ labels: z.array(z.string()) });

export const labelSuggestQuerySchema = z.object({
  q: z.string().trim().max(60).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const labelUsageSchema = z.object({
  name: z.string(),
  pageCount: z.number().int().nonnegative(),
});

export const labelSuggestResponseSchema = listSchema(labelUsageSchema);

export const starResponseSchema = z.object({ starred: z.boolean() });

export type SetLabelsBody = z.infer<typeof setLabelsBodySchema>;
export type LabelsResponse = z.infer<typeof labelsResponseSchema>;
export type LabelSuggestQuery = z.infer<typeof labelSuggestQuerySchema>;
export type LabelUsage = z.infer<typeof labelUsageSchema>;
export type StarResponse = z.infer<typeof starResponseSchema>;
