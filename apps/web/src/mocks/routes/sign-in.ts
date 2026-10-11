import type { LoginRequest, PasswordResetComplete } from '@bemmoly/shared';
import type { MockDb } from '../db.ts';
import { ssoOf } from './sso.ts';
import { restarting } from './update-job.ts';
import { bodyOf, fail, ok, type MockResponse, type MockRoute } from '../types.ts';

/** The server's per-account sign-in budget, shortened so the countdown can be seen in dev. */
export const MOCK_SIGN_IN_BUDGET = 5;
export const MOCK_SIGN_IN_WINDOW_MS = 60_000;

const down = (): MockResponse => ({
  status: 503,
  body: { code: 'internal_error', message: 'The server is starting.', requestId: 'mock-down' },
});

function signedIn(db: MockDb, userId: string): MockResponse {
  db.signedInAs = userId;
  const user = db.users.find((entry) => entry.id === userId);
  if (user) user.lastSeenAt = new Date().toISOString();
  return ok({ user });
}

/** Counts a failure and answers 429 with Retry-After once the budget is spent, as the server does. */
function budget(db: MockDb, email: string, failed: boolean): MockResponse | null {
  const now = Date.now();
  db.signInFailures ??= {};
  const recent = (db.signInFailures[email] ?? []).filter((at) => now - at < MOCK_SIGN_IN_WINDOW_MS);
  if (failed) recent.push(now);
  db.signInFailures[email] = recent;
  if (recent.length <= MOCK_SIGN_IN_BUDGET) return null;
  const waitMs = MOCK_SIGN_IN_WINDOW_MS - (now - (recent[0] ?? now));
  const seconds = Math.max(1, Math.ceil(waitMs / 1000));
  return {
    ...fail(429, 'rate_limited', `Too many sign-in attempts. Try again in ${seconds} seconds.`, {
      retryAfterSeconds: seconds,
    }),
    headers: { 'retry-after': String(seconds) },
  };
}

/**
 * Sign-in and password reset with the server's answers, so every state on the sign-in pages
 * can be checked against the mock: a wrong password, the per-account rate limit with its wait,
 * a deactivated account, single sign-on required, a server that is down, and a reset that
 * signs in when it is saved.
 */
export const signInRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/readyz',
    anonymous: true,
    handle: (_, db) =>
      db.authDown || restarting(db)
        ? { status: 503, body: { status: 'starting' } }
        : ok({ status: 'ready', checks: { database: { status: 'ok', latencyMs: 12 } } }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/auth/login',
    anonymous: true,
    handle: (request, db) => {
      if (db.authDown) return down();
      const body = bodyOf<LoginRequest>(request);
      const email = body.email?.toLowerCase() ?? '';
      const limited = budget(db, email, false);
      if (limited) return limited;
      const user = db.users.find((entry) => entry.email === email);
      if (!user || db.passwords[user.email] !== body.password) {
        return (
          budget(db, email, true) ?? fail(401, 'unauthenticated', 'Email or password is incorrect')
        );
      }
      if (user.status !== 'active') {
        return fail(401, 'unauthenticated', 'This account has been deactivated', {
          reason: 'deactivated',
        });
      }
      const sso = ssoOf(db);
      if (sso.requireSso && sso.providers.some((p) => p.enabled) && !user.isBreakGlass) {
        return fail(403, 'forbidden', 'This workspace signs in with single sign-on.', {
          reason: 'sso_required',
        });
      }
      return signedIn(db, user.id);
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/auth/password-reset/preview',
    anonymous: true,
    handle: (request, db) => {
      const token = bodyOf<{ token: string }>(request).token ?? '';
      const email = db.resetTokens[token];
      if (!email) return fail(400, 'bad_request', 'This reset link is invalid or has expired');
      return ok({ email });
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/auth/password-reset/complete',
    anonymous: true,
    handle: (request, db) => {
      const body = bodyOf<PasswordResetComplete>(request);
      const email = body.token ? db.resetTokens[body.token] : undefined;
      const user = db.users.find((entry) => entry.email === email);
      if (!email || !body.password || !user) {
        return fail(400, 'bad_request', 'This reset link is invalid or has expired');
      }
      db.passwords[email] = body.password;
      delete db.resetTokens[body.token as string];
      return signedIn(db, user.id);
    },
  },
];
