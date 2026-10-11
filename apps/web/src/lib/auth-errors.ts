import { isApiError } from '@bemmoly/api-client';

/**
 * Why a sign-in did not work, in the few kinds the sign-in page treats differently: a field
 * error for a wrong password, a countdown for a rate limit, a note naming who can help for a
 * deactivated account, and an automatic retry when the server is not answering.
 */
export type SignInFailure =
  | { kind: 'wrong-password' }
  | { kind: 'rate-limited'; retryAfterSeconds: number }
  | { kind: 'deactivated' }
  | { kind: 'sso-required' }
  | { kind: 'server-down' }
  | { kind: 'timeout' }
  | { kind: 'other'; message: string; requestId: string | undefined };

/** When the server gives no wait, a minute is the sign-in budget's window. */
const DEFAULT_WAIT_SECONDS = 60;

const reasonOf = (details: unknown): string | undefined => {
  const reason = (details as { reason?: unknown } | undefined)?.reason;
  return typeof reason === 'string' ? reason : undefined;
};

const waitOf = (error: { retryAfterSeconds: number | undefined; details: unknown }) => {
  const fromBody = (error.details as { retryAfterSeconds?: unknown } | undefined)
    ?.retryAfterSeconds;
  const seconds = error.retryAfterSeconds ?? (typeof fromBody === 'number' ? fromBody : undefined);
  return Math.max(1, Math.ceil(seconds ?? DEFAULT_WAIT_SECONDS));
};

/** A request that never reached a working server: no connection, a gateway, or a restart. */
export function isServerDown(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return (
    error.code === 'network_error' ||
    error.code === 'maintenance' ||
    [502, 503, 504].includes(error.status)
  );
}

export function signInFailure(error: unknown): SignInFailure {
  if (error instanceof DOMException && error.name === 'TimeoutError') return { kind: 'timeout' };
  if (!isApiError(error)) {
    return { kind: 'other', message: 'Something went wrong on this page.', requestId: undefined };
  }
  if (isServerDown(error)) return { kind: 'server-down' };
  if (error.code === 'rate_limited') {
    return { kind: 'rate-limited', retryAfterSeconds: waitOf(error) };
  }
  const reason = reasonOf(error.details);
  if (reason === 'deactivated') return { kind: 'deactivated' };
  if (reason === 'sso_required') return { kind: 'sso-required' };
  if (error.code === 'unauthenticated') {
    return /deactivated/i.test(error.message)
      ? { kind: 'deactivated' }
      : { kind: 'wrong-password' };
  }
  // Request ids are for support, so only a failure on the server's side shows one.
  return {
    kind: 'other',
    message: error.message,
    requestId: error.status >= 500 ? error.requestId : undefined,
  };
}

/** "0:42" for a countdown. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
