import { forgetOidcDiscovery } from '@bemmoly/core';
import { startFakeOidcProvider, type FakeOidcProvider } from '@bemmoly/core/testing';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  addPerson,
  call,
  createFirstAdmin,
  linkToken,
  roleId,
  startHarness,
  type Harness,
} from './harness.ts';
import { bindingCookie, createOidcProvider, pathOf, signInWithOidc } from './sso-support.ts';

/** Settings › Sign-in's "Test sign-in": the round trip, finished in the admin's browser. */
async function testSignIn(
  app: FastifyInstance,
  fake: FakeOidcProvider,
  cookie: string,
  id: string,
) {
  const started = await call(app, 'POST', `/admin/sso/providers/${id}/tests`, { cookie });
  expect(started.statusCode, started.body).toBe(201);
  const callback = fake.authorize(started.json().authorizationUrl);
  const landed = await app.inject({
    method: 'GET',
    url: pathOf(callback),
    headers: { cookie: `${bindingCookie(started)}; ${cookie}` },
  });
  return landed;
}

describe('Settings › Sign-in: providers, tests and require-SSO', () => {
  let harness: Harness | undefined;
  let fake: FakeOidcProvider;
  let skipReason = '';

  beforeAll(async () => {
    fake = await startFakeOidcProvider();
    const started = await startHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });
  afterAll(async () => {
    await harness?.stop();
    await fake.stop();
  });
  beforeEach(async () => {
    await harness?.reset();
    forgetOidcDiscovery();
    fake.tamper = {};
    fake.user = { sub: 'sub-ada', email: 'ada@acme.dev', emailVerified: true, name: 'Ada' };
  });

  it('keeps secrets encrypted and write-only, and audits every change without them', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, sql } = harness;
    const admin = await createFirstAdmin(app);
    const id = await createOidcProvider(app, admin.cookie, fake);
    const shown = (
      await call(app, 'GET', `/admin/sso/providers/${id}`, { cookie: admin.cookie })
    ).json();
    expect(shown.config).toMatchObject({ protocol: 'oidc', hasClientSecret: true });
    expect(JSON.stringify(shown)).not.toContain(fake.clientSecret);
    expect(shown.serviceProvider.callbackUrl).toBe(
      `http://localhost:8080/api/v1/auth/sso/providers/${id}/callback`,
    );
    const [row] = await sql`SELECT config_encrypted FROM auth_providers WHERE id = ${id}`;
    expect(String(row?.['config_encrypted'])).toMatch(/^v1\./);
    expect(String(row?.['config_encrypted'])).not.toContain(fake.clientSecret);

    // An update without the secret keeps it: sign-in still works.
    const renamed = await call(app, 'PATCH', `/admin/sso/providers/${id}`, {
      cookie: admin.cookie,
      body: {
        displayName: 'Acme',
        config: { protocol: 'oidc', issuerUrl: fake.issuer, clientId: fake.clientId },
      },
    });
    expect(renamed.statusCode, renamed.body).toBe(200);
    expect((await signInWithOidc(app, fake, id)).session).toBeDefined();

    const audit =
      await sql`SELECT action, before, after FROM audit_log WHERE target_id = ${id} ORDER BY id`;
    expect(audit.map((entry) => entry['action'])).toEqual([
      'sso.provider_created',
      'sso.provider_updated',
    ]);
    expect(JSON.stringify(audit)).not.toContain(fake.clientSecret);
  });

  it('refuses configurations that would not be safe, and people without the capability', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const admin = await createFirstAdmin(app);
    const plainHttp = await call(app, 'POST', '/admin/sso/providers', {
      cookie: admin.cookie,
      body: {
        displayName: 'X',
        config: { protocol: 'oidc', issuerUrl: 'http://idp.example.com', clientId: 'x' },
      },
    });
    expect(plainHttp.statusCode).toBe(400);
    const badCert = await call(app, 'POST', '/admin/sso/providers', {
      cookie: admin.cookie,
      body: {
        displayName: 'X',
        config: {
          protocol: 'saml',
          idpEntityId: 'https://idp.test',
          idpSsoUrl: 'https://idp.test/sso',
          idpCertificate: `-----BEGIN CERTIFICATE-----\n${'A'.repeat(80)}\n-----END CERTIFICATE-----`,
        },
      },
    });
    expect(badCert.statusCode).toBe(400);
    const member = await addPerson(harness, admin.cookie, { email: 'm@acme.dev', role: 'member' });
    expect(
      (await call(app, 'GET', '/admin/sso/providers', { cookie: member.cookie })).statusCode,
    ).toBe(403);
    expect(
      (await call(app, 'GET', '/admin/sso/policy', { cookie: member.cookie })).statusCode,
    ).toBe(403);
    expect(
      (
        await call(app, 'POST', '/admin/scim-tokens', {
          cookie: member.cookie,
          body: { name: 'x' },
        })
      ).statusCode,
    ).toBe(403);
  });

  it('records a test sign-in on the provider without signing anyone in', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, sql } = harness;
    const admin = await createFirstAdmin(app);
    const id = await createOidcProvider(app, admin.cookie, fake);
    fake.user.groups = ['engineers'];
    const landed = await testSignIn(app, fake, admin.cookie, id);
    expect(landed.headers.location).toBe('http://localhost:8080/settings/authentication');
    expect(landed.headers['set-cookie']).not.toContain('bemmoly_session=');
    const provider = (
      await call(app, 'GET', `/admin/sso/providers/${id}`, { cookie: admin.cookie })
    ).json();
    expect(provider.lastTest).toMatchObject({
      ok: true,
      email: 'ada@acme.dev',
      groups: ['engineers'],
    });
    expect((await sql`SELECT count(*)::int AS n FROM users`)[0]?.['n']).toBe(1);

    fake.tamper = { audience: 'someone-else' };
    await testSignIn(app, fake, admin.cookie, id);
    const failed = (
      await call(app, 'GET', `/admin/sso/providers/${id}`, { cookie: admin.cookie })
    ).json();
    expect(failed.lastTest).toMatchObject({ ok: false, reason: 'invalid_response' });
  });

  it('requires SSO only after a passing test, keeping a break-glass admin', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, events } = harness;
    const admin = await createFirstAdmin(app);
    const member = await addPerson(harness, admin.cookie, { email: 'm@acme.dev', role: 'member' });
    const id = await createOidcProvider(app, admin.cookie, fake);
    const pat = await call(app, 'POST', '/api-tokens', {
      cookie: member.cookie,
      body: { name: 'script', scopes: ['read'] },
    });
    expect(pat.statusCode, pat.body).toBe(201);
    const policy = (body: object) =>
      call(app, 'PUT', '/admin/sso/policy', { cookie: admin.cookie, body });

    expect((await policy({ requireSso: true })).statusCode).toBe(409);
    await testSignIn(app, fake, admin.cookie, id);
    const required = await policy({ requireSso: true });
    expect(required.statusCode, required.body).toBe(200);
    expect(required.json()).toMatchObject({
      requireSso: true,
      breakGlassAdmins: [{ id: admin.userId, email: ADMIN.email }],
    });
    expect((await call(app, 'GET', '/auth/sso/providers')).json().requireSso).toBe(true);

    const memberLogin = await call(app, 'POST', '/auth/login', {
      body: { email: 'm@acme.dev', password: 'a long enough password' },
    });
    expect(memberLogin.statusCode).toBe(403);
    expect(memberLogin.json().message).toContain('single sign-on');
    const wrongPassword = await call(app, 'POST', '/auth/login', {
      body: { email: 'm@acme.dev', password: 'not the password at all' },
    });
    expect(wrongPassword.statusCode).toBe(401);
    expect((await call(app, 'POST', '/auth/login', { body: ADMIN })).statusCode).toBe(200);
    // Personal access tokens are not a password sign-in: they keep working, and an admin
    // revokes them or deactivates the person to stop them.
    const viaToken = await call(app, 'GET', '/me', { token: pat.json().token });
    expect(viaToken.statusCode).toBe(200);
    expect(viaToken.json().user.id).toBe(member.userId);

    await call(app, 'POST', '/invitations', {
      cookie: admin.cookie,
      body: { emails: ['new@acme.dev'], roleId: await roleId(app, admin.cookie, 'viewer') },
    });
    const invite = events.findLast(
      (event) => (event.payload as { email: string }).email === 'new@acme.dev',
    );
    const token = linkToken((invite?.payload as { acceptUrl: string }).acceptUrl);
    const accepted = await call(app, 'POST', `/auth/invitations/${token}/accept`, {
      body: { name: 'New', password: 'a long enough password' },
    });
    expect(accepted.statusCode).toBe(403);

    const disable = await call(app, 'PATCH', `/admin/sso/providers/${id}`, {
      cookie: admin.cookie,
      body: { enabled: false },
    });
    expect(disable.statusCode).toBe(409);
    expect(
      (await call(app, 'DELETE', `/admin/sso/providers/${id}`, { cookie: admin.cookie }))
        .statusCode,
    ).toBe(409);

    expect((await policy({ requireSso: false })).statusCode).toBe(200);
    const again = await call(app, 'POST', '/auth/login', {
      body: { email: 'm@acme.dev', password: 'a long enough password' },
    });
    expect(again.statusCode).toBe(200);
  });

  it('signs out an SSO session like any other', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const admin = await createFirstAdmin(app);
    const id = await createOidcProvider(app, admin.cookie, fake);
    const landing = await signInWithOidc(app, fake, id);
    expect((await call(app, 'POST', '/auth/logout', { cookie: landing.session })).statusCode).toBe(
      204,
    );
    expect((await call(app, 'GET', '/me', { cookie: landing.session })).statusCode).toBe(401);
  });
});
