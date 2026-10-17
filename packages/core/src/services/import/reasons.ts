import { HttpStatusError } from '../../clients/http-json.ts';

/**
 * Why a run, or one project of it, stopped, in words an admin can act on; stack traces stay
 * in the log. A source that kept refusing with "too many requests" after every backoff says
 * so, since the fix is to wait or ask its admin, not to change anything here.
 */
export function reasonOf(error: unknown, source = 'The source'): string {
  if (error instanceof HttpStatusError) {
    if (error.status === 429) return `${source} kept answering “too many requests”`;
    if (error.status === 503) return `${source} kept answering that it is unavailable`;
    if (error.status === 401 || error.status === 403) {
      return `${source} refused the token for this; check its access`;
    }
  }
  const cause =
    error instanceof Error && error.cause instanceof HttpStatusError ? error.cause : null;
  if (cause && [429, 503, 401, 403].includes(cause.status)) return reasonOf(cause, source);
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000) || 'The import stopped with an unknown error';
}
