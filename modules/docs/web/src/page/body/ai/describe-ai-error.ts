import { ApiError } from '@bemmoly/api-client';

/*
 * What the suggestion card says when AI could not write: the refusal's reason or the
 * provider's own failure, in plain words. The server's messages are already written for
 * people (the runtime names the provider and any retry), so they are used as they come.
 */

const REFUSALS: Record<string, string> = {
  ai_off: 'AI is turned off for this workspace.',
  role_unset:
    'No model is set for this kind of task yet. An admin can choose one in Settings › AI.',
  budget_reached: 'This month’s AI budget is spent. It resets on the 1st.',
  opted_out: 'You turned AI off for yourself.',
  excluded: 'This space is excluded from AI, so nothing on this page is sent.',
  actions_off: 'AI actions are turned off for this workspace.',
};

const reasonOf = (details: unknown) =>
  typeof details === 'object' && details !== null
    ? (details as { reason?: unknown }).reason
    : undefined;

export function describeAiError(error: unknown): string {
  if (error instanceof ApiError) {
    const reason = reasonOf(error.details);
    if (typeof reason === 'string' && REFUSALS[reason]) {
      // Share content off is refused as "excluded" with its own message; keep that one.
      return reason === 'excluded' && error.message.includes('share')
        ? `${error.message}.`
        : (REFUSALS[reason] ?? error.message);
    }
    if (error.code === 'network_error') return 'Bemmoly could not reach the server. Try again.';
    if (error.message) return error.message;
  }
  return 'Couldn’t write that. Try again in a moment.';
}

/** A refusal: asking again will not help until something changes. */
export const isAiRefusal = (error: unknown) =>
  error instanceof ApiError && error.status === 403 && typeof reasonOf(error.details) === 'string';
