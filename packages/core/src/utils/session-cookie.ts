/** The one session cookie: an opaque token, httpOnly, SameSite=Lax, Secure on https. */
export const SESSION_COOKIE = 'bemmoly_session';

const COOKIE_VALUE = /^[A-Za-z0-9_-]{16,128}$/;

/** Reads one cookie by name; ignores values that are not tokens we could have issued. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const value = part.slice(index + 1).trim();
    return COOKIE_VALUE.test(value) ? value : undefined;
  }
  return undefined;
}

export interface CookiePolicy {
  /** true when the public URL is https; browsers drop Secure cookies on plain http hosts. */
  secure: boolean;
}

export function cookiePolicyFor(publicUrl: string): CookiePolicy {
  return { secure: new URL(publicUrl).protocol === 'https:' };
}

function attributes(policy: CookiePolicy, maxAgeSeconds: number): string {
  return [
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
    ...(policy.secure ? ['Secure'] : []),
  ].join('; ');
}

export function serializeSessionCookie(
  token: string,
  expiresAt: Date,
  policy: CookiePolicy,
  now = new Date(),
) {
  const maxAge = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 1000));
  return `${SESSION_COOKIE}=${token}; ${attributes(policy, maxAge)}`;
}

export function clearSessionCookie(policy: CookiePolicy): string {
  return `${SESSION_COOKIE}=; ${attributes(policy, 0)}`;
}
