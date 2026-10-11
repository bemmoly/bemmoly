import { createFakeSamlIdp, type FakeSamlIdp, type FakeSamlTampering } from '@bemmoly/core/testing';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  call,
  createFirstAdmin,
  roleId,
  sessionCookie,
  startHarness,
  type Harness,
} from './harness.ts';
import {
  createSamlProvider,
  failureOf,
  locationOf,
  nextAddress,
  pathOf,
  startSso,
} from './sso-support.ts';

const callbackOf = (id: string) => `http://localhost:8080/api/v1/auth/sso/providers/${id}/callback`;
const entityOf = (id: string) => `http://localhost:8080/api/v1/auth/sso/providers/${id}/metadata`;

/** The identity provider's form POST to the assertion consumer, as a browser sends it cross-site. */
async function postResponse(
  app: FastifyInstance,
  id: string,
  samlResponse: string,
  relayState: string,
) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/auth/sso/providers/${id}/callback`,
    remoteAddress: nextAddress(),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: 'https://idp.fake.test',
      'sec-fetch-site': 'cross-site',
    },
    payload: new URLSearchParams({ SAMLResponse: samlResponse, RelayState: relayState }).toString(),
  });
}

describe('SAML sign-in against a fake identity provider and a real database', () => {
  let harness: Harness | undefined;
  let idp: FakeSamlIdp;
  let skipReason = '';

  beforeAll(async () => {
    idp = await createFakeSamlIdp();
    const started = await startHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });
  afterAll(async () => harness?.stop());
  beforeEach(async () => harness?.reset());

  /** Start, the IdP's signed response, the cross-site POST and the same-site hand-over. */
  async function signIn(
    app: FastifyInstance,
    id: string,
    options: { tamper?: FakeSamlTampering; groups?: string[]; binding?: string | null } = {},
  ) {
    const started = await startSso(app, id, '/docs');
    const request = idp.readRequest(started.location);
    const samlResponse = await idp.respond({
      callbackUrl: callbackOf(id),
      entityId: entityOf(id),
      requestId: request.id,
      user: { email: 'grace@acme.dev', name: 'Grace H.', groups: options.groups ?? [] },
      ...(options.tamper ? { tamper: options.tamper } : {}),
    });
    const posted = await postResponse(app, id, samlResponse, request.relayState);
    if (!locationOf(posted).includes('/auth/sso/complete')) {
      return { posted, location: locationOf(posted), session: undefined, samlResponse, request };
    }
    const binding = options.binding === null ? undefined : (options.binding ?? started.binding);
    const completed = await app.inject({
      method: 'GET',
      url: pathOf(locationOf(posted)),
      remoteAddress: nextAddress(),
      headers: binding ? { cookie: binding } : {},
    });
    return {
      posted,
      location: locationOf(completed),
      session: sessionCookie(completed),
      samlResponse,
      request,
    };
  }

  it('signs a new person in through a signed assertion and maps their groups', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const admin = await createFirstAdmin(app);
    const memberRole = await roleId(app, admin.cookie, 'member');
    const id = await createSamlProvider(app, admin.cookie, idp, {
      roleMappings: [{ group: 'staff', roleId: memberRole }],
    });
    const landing = await signIn(app, id, { groups: ['staff'] });
    expect(landing.posted.statusCode).toBe(303);
    expect(landing.location).toBe('http://localhost:8080/docs');
    const me = (await call(app, 'GET', '/me', { cookie: landing.session })).json().user;
    expect(me).toMatchObject({ email: 'grace@acme.dev', name: 'Grace H.', roleId: memberRole });
  });

  it('publishes service provider metadata that asks for signed assertions', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const admin = await createFirstAdmin(app);
    const id = await createSamlProvider(app, admin.cookie, idp);
    const metadata = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/sso/providers/${id}/metadata`,
    });
    expect(metadata.statusCode).toBe(200);
    expect(metadata.headers['content-type']).toContain('application/samlmetadata+xml');
    expect(metadata.body).toContain(`entityID="${entityOf(id)}"`);
    expect(metadata.body).toContain('WantAssertionsSigned="true"');
    expect(metadata.body).toContain(callbackOf(id));
  });

  it.for<[string, FakeSamlTampering, string]>([
    ['an unsigned response', { signing: 'none' }, 'invalid_response'],
    ['a response signed only on the envelope', { signing: 'response' }, 'invalid_response'],
    ['a signature from another certificate', { signing: 'foreign' }, 'invalid_response'],
    ['a wrapped second assertion', { wrapAnotherAssertion: 'eve@evil.test' }, 'invalid_response'],
    ['a wrong audience', { audience: 'https://someone-else.test' }, 'invalid_response'],
    ['a wrong recipient', { recipient: 'https://someone-else.test/acs' }, 'invalid_response'],
    ['a wrong destination', { destination: 'https://someone-else.test/acs' }, 'invalid_response'],
    ['an answer to another request', { inResponseTo: '_not-our-request' }, 'replayed'],
    ['a wrong issuer', { issuer: 'https://other-idp.test' }, 'invalid_response'],
    ['an expired assertion', { expiresInMinutes: -10 }, 'expired'],
    ['an assertion not valid yet', { notBeforeInMinutes: 30 }, 'expired'],
  ])('refuses %s', async ([, tamper, reason], ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const admin = await createFirstAdmin(app);
    const id = await createSamlProvider(app, admin.cookie, idp);
    const landing = await signIn(app, id, { tamper: { ...tamper } });
    expect(failureOf(landing)).toBe(reason);
    expect(landing.session).toBeUndefined();
  });

  it('accepts an assertion once, and only in the browser that started the sign-in', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const admin = await createFirstAdmin(app);
    const id = await createSamlProvider(app, admin.cookie, idp);
    const first = await signIn(app, id);
    expect(first.session).toBeDefined();
    const replayed = await postResponse(app, id, first.samlResponse, first.request.relayState);
    expect(failureOf({ location: locationOf(replayed) })).toBe('replayed');

    const elsewhere = await signIn(app, id, { binding: null });
    expect(failureOf(elsewhere)).toBe('state_mismatch');
    expect(elsewhere.session).toBeUndefined();
  });
});
