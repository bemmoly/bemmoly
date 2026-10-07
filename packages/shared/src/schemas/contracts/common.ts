import { z } from 'zod';

/** Primary keys are UUIDv7 on the server; the client treats them as opaque strings. */
export const idSchema = z.string().min(1);

export const timestampSchema = z.iso.datetime({ offset: true });

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex colour');

/** Passwords: a minimum length and a sane upper bound; strength is the server's call. */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(256, 'Use at most 256 characters');

/** Keyset pagination: opaque cursor plus a limit of at most 200 (tech design, API conventions). */
export const pageQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}

export function listSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item) });
}

/** A labelled reference to another record, enough to render a chip or a link. */
export const refSchema = z.object({ id: idSchema, name: z.string() });

export type PageQuery = z.infer<typeof pageQuerySchema>;
export type Ref = z.infer<typeof refSchema>;
