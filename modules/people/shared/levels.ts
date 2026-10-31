import { z } from 'zod';

/*
 * The company's career ladder. The person record keeps the level as free text (ADR 0050);
 * People keeps the list the profile picks from, in ladder order.
 */

export const levelSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
});

export const createLevelBodySchema = z.object({
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200).nullish(),
  position: z.number().int().min(0).max(1000).optional(),
});

export const updateLevelBodySchema = createLevelBodySchema.partial();

export const levelsResponseSchema = z.object({ items: z.array(levelSchema) });

export type Level = z.infer<typeof levelSchema>;
export type CreateLevelBody = z.input<typeof createLevelBodySchema>;
export type UpdateLevelBody = z.input<typeof updateLevelBodySchema>;
