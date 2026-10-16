import { ApiError } from '@bemmoly/api-client';
import { z } from 'zod';

/**
 * "Why can't I?" always has an answer: a refused action comes back as forbidden with the
 * decision in words and who can grant it. Anything else is an ordinary failure.
 */
const refusalSchema = z.object({
  sentence: z.string().min(1),
  askWho: z.string().nullable().optional(),
});

export interface Refusal {
  sentence: string;
  askWho: string | null;
}

export function refusalOf(error: unknown): Refusal | null {
  if (!(error instanceof ApiError) || error.code !== 'forbidden') return null;
  const parsed = refusalSchema.safeParse(error.details);
  if (!parsed.success) return null;
  return { sentence: parsed.data.sentence, askWho: parsed.data.askWho ?? null };
}
