import type { CookiePolicy } from './session-cookie.ts';

/**
 * Binds a single sign-on flow to the browser that started it. Scoped to the SSO routes,
 * httpOnly and SameSite=Lax: sent on the same-site GETs that finish a flow, never on the
 * identity provider's cross-site POST, which is why SAML hops through `complete`.
 */
export const SSO_BINDING_COOKIE = 'bemmoly_sso';
const SSO_COOKIE_PATH = '/api/v1/auth/sso';

function attributes(policy: CookiePolicy, maxAgeSeconds: number): string {
  return [
    `Path=${SSO_COOKIE_PATH}`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
    ...(policy.secure ? ['Secure'] : []),
  ].join('; ');
}

export function serializeSsoCookie(
  token: string,
  expiresAt: Date,
  policy: CookiePolicy,
  now = new Date(),
): string {
  const maxAge = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 1000));
  return `${SSO_BINDING_COOKIE}=${token}; ${attributes(policy, maxAge)}`;
}

export function clearSsoCookie(policy: CookiePolicy): string {
  return `${SSO_BINDING_COOKIE}=; ${attributes(policy, 0)}`;
}
