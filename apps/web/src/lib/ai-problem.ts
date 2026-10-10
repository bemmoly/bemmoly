import { isApiError } from '@bemmoly/api-client';
import {
  aiProviderErrorDetailsSchema,
  aiRefusalDetailsSchema,
  type AiRefusalReason,
} from '@bemmoly/shared';

/** What went wrong with an AI call, in the words the palette shows. */
export interface AiProblem {
  kind: 'refused' | 'provider' | 'failed';
  reason?: AiRefusalReason;
  title: string;
  body: string;
  /** Worth trying again now (a provider hiccup, a dropped connection). */
  retry: boolean;
}

const REFUSALS: Record<AiRefusalReason, { title: string; body: string }> = {
  ai_off: {
    title: 'AI is turned off',
    body: 'Search and every other command still work.',
  },
  role_unset: {
    title: 'No model is set for this yet',
    body: 'An admin picks one in Settings › AI. Search still works.',
  },
  budget_reached: {
    title: "This month's AI budget is spent",
    body: 'Plans and answers resume on the 1st. Search and every other command still work.',
  },
  opted_out: {
    title: 'You turned AI off for yourself',
    body: 'Turn it back on in your profile to plan and ask here.',
  },
  excluded: {
    title: 'That content is excluded from AI',
    body: 'An admin chose to keep it out of AI in Settings › AI.',
  },
  actions_off: {
    title: 'AI actions that change data are turned off',
    body: 'Bemmoly can still draft the plan for you to make by hand.',
  },
};

function retryWords(seconds: number | null): string {
  if (!seconds) return 'Try again in a moment;';
  return `Try again in ${seconds < 60 ? `${seconds} seconds` : 'a few minutes'};`;
}

/** An ApiError, or the error event that ends an answer's stream, as one shape. */
function partsOf(error: unknown): { status: number; details: unknown; message: string } | null {
  if (isApiError(error)) {
    return { status: error.status, details: error.details, message: error.message };
  }
  if (typeof error !== 'object' || error === null) return null;
  const event = error as { code?: unknown; message?: unknown; details?: unknown };
  if (typeof event.code !== 'string' || typeof event.message !== 'string') return null;
  const status = event.code === 'forbidden' ? 403 : event.code === 'provider_error' ? 502 : 500;
  return { status, details: event.details, message: event.message };
}

/** Turns an error from a plan or an answer into honest copy. */
export function aiProblemOf(error: unknown): AiProblem {
  const parts = partsOf(error);
  if (parts) {
    const refusal = aiRefusalDetailsSchema.safeParse(parts.details);
    if (parts.status === 403 && refusal.success) {
      const reason = refusal.data.reason;
      return { kind: 'refused', reason, ...REFUSALS[reason], retry: false };
    }
    const provider = aiProviderErrorDetailsSchema.safeParse(parts.details);
    if (provider.success) {
      const { provider: name, failure, retryAfterSeconds } = provider.data;
      const what =
        failure === 'rate_limit'
          ? `${name} returned a rate limit.`
          : failure === 'auth'
            ? `${name} refused the key.`
            : failure === 'timeout'
              ? `${name} took too long to answer.`
              : `${name} didn't answer.`;
      return {
        kind: 'provider',
        title: "The AI provider didn't answer",
        body: `${what} ${retryWords(retryAfterSeconds)} search still works.`,
        retry: failure !== 'auth',
      };
    }
    return {
      kind: 'failed',
      title: "Couldn't do that",
      body: parts.message,
      retry: parts.status >= 500,
    };
  }
  return {
    kind: 'failed',
    title: "Couldn't reach Bemmoly",
    body: 'Check your connection and try again.',
    retry: true,
  };
}
