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

/**
 * The server's own sentence for a write it turned down because of what was asked: a refusal,
 * a clash ("An environment called dev exists already") or a rule the request broke ("acme-prod
 * failed its last check…"). Those say what to do next better than a generic line could;
 * anything else (offline, a crash) is null so the caller says to try again.
 */
const SAYS_WHY = new Set(['conflict', 'validation_failed', 'bad_request', 'not_found']);

export function sentenceOf(error: unknown): string | null {
  const refusal = refusalOf(error);
  if (refusal) return refusal.sentence;
  if (error instanceof ApiError && SAYS_WHY.has(error.code) && error.message) return error.message;
  return null;
}
