import type { FakeOidcProvider, FakeSamlIdp } from '@bemmoly/core/testing';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { expect } from 'vitest';
import { call, ORIGIN, sessionCookie } from './harness.ts';

const SSO_COOKIE = 'bemmoly_sso=';

let clients = 0;
/** Each round trip from its own address, so the strict per-IP budget on /auth/* is not the subject. */
export const nextAddress = () => `10.9.${Math.floor(++clients / 250) % 250}.${clients % 250}`;

/** The `name=value` pair of a response's SSO binding cookie. */
export function bindingCookie(response: LightMyRequestResponse): string | undefined {
  const header = response.headers['set-cookie'];
  const values = Array.isArray(header) ? header : header ? [header] : [];
  const pair = values.find((value) => value.startsWith(SSO_COOKIE))?.split(';')[0];
  return pair && pair !== SSO_COOKIE ? pair : undefined;
}

export const locationOf = (response: LightMyRequestResponse) =>
  String(response.headers.location ?? '');

/** A path under this server from an absolute URL it issued. */
export const pathOf = (url: string) => {
  const parsed = new URL(url);
  expect(parsed.origin).toBe(ORIGIN);
  return `${parsed.pathname}${parsed.search}`;
};

export async function createOidcProvider(
  app: FastifyInstance,
  cookie: string,
  fake: FakeOidcProvider,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const response = await call(app, 'POST', '/admin/sso/providers', {
    cookie,
    body: {
      displayName: 'Acme sign-in',
      config: {
        protocol: 'oidc',
        issuerUrl: fake.issuer,
        clientId: fake.clientId,
        clientSecret: fake.clientSecret,
      },
      ...extra,
    },
  });
  expect(response.statusCode, response.body).toBe(201);
  return (response.json() as { id: string }).id;
}

export async function createSamlProvider(
  app: FastifyInstance,
  cookie: string,
  idp: FakeSamlIdp,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const response = await call(app, 'POST', '/admin/sso/providers', {
    cookie,
    body: {
      displayName: 'Acme SAML',
      config: {
        protocol: 'saml',
        idpEntityId: idp.entityId,
        idpSsoUrl: idp.ssoUrl,
        idpCertificate: idp.certificate,
      },
      ...extra,
    },
  });
  expect(response.statusCode, response.body).toBe(201);
  return (response.json() as { id: string }).id;
}

export interface Landing {
  response: LightMyRequestResponse;
  /** Where the browser was sent: a path under the server. */
  location: string;
  session: string | undefined;
}

/** "Continue with SSO": the start redirect and the binding cookie it sets. */
export async function startSso(app: FastifyInstance, providerId: string, returnTo?: string) {
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/auth/sso/providers/${providerId}/start${query}`,
    remoteAddress: nextAddress(),
  });
  return { response, location: locationOf(response), binding: bindingCookie(response) };
}

/** The full OIDC round trip: start, the fake provider's authorize redirect, the callback. */
export async function signInWithOidc(
  app: FastifyInstance,
  providerId: string,
  options: { returnTo?: string; cookie?: string | undefined; binding?: string | null } = {},
): Promise<Landing> {
  const started = await startSso(app, providerId, options.returnTo);
  expect(started.response.statusCode, started.response.body).toBe(303);
  const authorized = await fetch(started.location, { redirect: 'manual' });
  const callback = authorized.headers.get('location') ?? '';
  const binding = options.binding === null ? undefined : (options.binding ?? started.binding);
  const cookies = [binding, options.cookie].filter(Boolean).join('; ');
  const response = await app.inject({
    method: 'GET',
    url: pathOf(callback),
    remoteAddress: nextAddress(),
    headers: cookies ? { cookie: cookies } : {},
  });
  return { response, location: locationOf(response), session: sessionCookie(response) };
}

/** The reason the sign-in page is asked to explain, from a failure redirect. */
export function failureOf(landing: { location: string }): string | null {
  return new URL(landing.location, ORIGIN).searchParams.get('sso_error');
}
