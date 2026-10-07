import { z } from 'zod';

/** Keyset pagination: an opaque cursor from the previous page and a page size up to 200. */
export const keysetQuerySchema = z.object({
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function keysetPageSchema<Item extends z.ZodType>(item: Item) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}

export const idParamsSchema = z.object({ id: z.uuid() });

export const emailSchema = z
  .string()
  .trim()
  .max(320)
  .pipe(z.email())
  .transform((value) => value.toLowerCase());

export const PASSWORD_MIN_LENGTH = 12;
/** Upper bound keeps hashing cost bounded for hostile input. */
export const PASSWORD_MAX_LENGTH = 1024;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH);

export const personNameSchema = z.string().trim().min(1).max(100);

export type KeysetQuery = z.infer<typeof keysetQuerySchema>;
export type IdParams = z.infer<typeof idParamsSchema>;
