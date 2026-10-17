import { ApiError } from '@bemmoly/api-client';
import { forbiddenDetailsSchema } from '@bemmoly/module-pipelines/shared';

/**
 * "Why can't I?" always has an answer: a refused action comes back as forbidden with the
 * decision in words and who can grant it ("Ask Payments for access"), in the shape the access
 * contract gives it. Anything else is an ordinary failure.
 */
export interface Refusal {
  sentence: string;
  askWho: string | null;
}

export function refusalOf(error: unknown): Refusal | null {
  if (!(error instanceof ApiError) || error.code !== 'forbidden') return null;
  const parsed = forbiddenDetailsSchema.safeParse(error.details);
  if (!parsed.success) return null;
  return { sentence: parsed.data.sentence, askWho: parsed.data.askWho?.label ?? null };
}
