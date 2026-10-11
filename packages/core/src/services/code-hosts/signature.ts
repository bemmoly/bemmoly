import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ValidationError } from '@bemmoly/shared';
import type { z } from 'zod';

/** Compares two secrets without leaking, through timing, how much of them matched. */
export function safeEqual(presented: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return expected.length > 0 && timingSafeEqual(digest(presented), digest(expected));
}

export const hmacSha256Hex = (secret: string, body: Buffer): string =>
  createHmac('sha256', secret).update(body).digest('hex');

/** A fallback delivery id when a host sends none: the same bytes are the same delivery. */
export const bodyDigest = (body: Buffer): string =>
  `sha256:${createHash('sha256').update(body).digest('hex')}`;

/** Reads a verified body against the host's loose payload schema. */
export function readPayload<Schema extends z.ZodType>(
  body: Buffer,
  schema: Schema,
  what: string,
): z.infer<Schema> {
  let json: unknown;
  try {
    json = JSON.parse(body.toString('utf8'));
  } catch {
    throw new ValidationError(`The ${what} delivery is not JSON`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ValidationError(`The ${what} delivery has an unexpected shape`);
  return parsed.data;
}
