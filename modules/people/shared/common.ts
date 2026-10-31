import { z } from 'zod';

/** A calendar date, `YYYY-MM-DD`: leave and journeys are calendar facts, not instants. */
export const dateSchema = z.iso.date();

export const nameSchema = z.string().trim().min(1).max(120);

export const userIdParamsSchema = z.object({ userId: z.uuid() });
export const idParamsSchema = z.object({ id: z.uuid() });

/** "true" and "false" in a query string, as people write them. */
export const queryFlagSchema = z.union([z.boolean(), z.stringbool()]);
