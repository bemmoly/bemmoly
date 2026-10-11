import { forgetOidcDiscovery } from '@bemmoly/core';
import {
  startFakeOidcProvider,
  type FakeOidcProvider,
  type FakeOidcTampering,
} from '@bemmoly/core/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, call, createFirstAdmin, roleId, startHarness, type Harness } from './harness.ts';
import { createOidcProvider, failureOf, signInWithOidc, startSso } from './sso-support.ts';

describe('OIDC sign-in against a fake provider and a real database', () => {
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
    fake.user = {
      sub: 'sub-ada',
      email: 'ada@acme.dev',
      emailVerified: true,
      name: 'Ada L.',
      groups: [],
    };
  });

  it('provisions a new person just in time, with PKCE and a nonce, and lands on returnTo', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, sql } = harness;
    const admin = await createFirstAdmin(app);
    const id = await createOidcProvider(app, admin.cookie, fake);

    const landing = await signInWithOidc(app, fake, id, { returnTo: '/work/issues?view=board' });
    expect(landing.response.statusCode).toBe(303);
    expect(landing.location).toBe('http://localhost:8080/work/issues?view=board');
    expect(landing.session).toBeDefined();
    const [request] = fake.authorizations.slice(-1);
    expect(request?.get('code_challenge_method')).toBe('S256');
    expect(request?.get('nonce')).toBeTruthy();
    expect(request?.get('scope')).toContain('openid');

    const me = await call(app, 'GET', '/me', { cookie: landing.session });
    expect(me.json().user).toMatchObject({
      email: 'ada@acme.dev',
      name: 'Ada L.',
      status: 'active',
    });
    expect(me.json().user.roleId).toBe(await roleId(app, admin.cookie, 'viewer'));
    const audit = await sql`
      SELECT action, after FROM audit_log WHERE actor_id = ${me.json().user.id} ORDER BY id`;
    expect(audit.map((row) => row['action'])).toEqual(['user.provisioned', 'session.created']);
    expect(audit[1]?.['after']).toMatchObject({ method: 'sso', providerId: id });
  });

  it('maps groups to a role and teams, and follows group changes on the next sign-in', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const admin = await createFirstAdmin(app);
    const team = await call(app, 'POST', '/teams', {
      cookie: admin.cookie,
      body: { name: 'Platform' },
    });
    const teamId = team.json().id as string;
    const memberRole = await roleId(app, admin.cookie, 'member');
    const id = await createOidcProvider(app, admin.cookie, fake, {
      roleMappings: [{ group: 'engineers', roleId: memberRole }],
      teamMappings: [{ group: 'platform', teamId }],
    });
    fake.user.groups = ['engineers', 'platform'];
    const first = await signInWithOidc(app, fake, id);
    const me = (await call(app, 'GET', '/me', { cookie: first.session })).json().user;
    expect(me.roleId).toBe(memberRole);
    expect(me.teamIds).toEqual([teamId]);

    fake.user.groups = ['engineers'];
    const second = await signInWithOidc(app, fake, id);
    expect((await call(app, 'GET', '/me', { cookie: second.session })).json().user.teamIds).toEqual(
      [],
    );
  });

  it('links an existing account by verified email, and refuses an unverified one', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const admin = await createFirstAdmin(app);
    const id = await createOidcProvider(app, admin.cookie, fake, { autoProvision: false });

    fake.user = { sub: 'sub-rohan', email: ADMIN.email, emailVerified: false };
    expect(failureOf(await signInWithOidc(app, fake, id))).toBe('email_unverified');

    fake.user = { sub: 'sub-rohan', email: ADMIN.email.toUpperCase(), emailVerified: true };
    const linked = await signInWithOidc(app, fake, id);
    expect((await call(app, 'GET', '/me', { cookie: linked.session })).json().user.id).toBe(
      admin.userId,
    );

    fake.user = { sub: 'sub-stranger', email: 'stranger@acme.dev', emailVerified: true };
    expect(failureOf(await signInWithOidc(app, fake, id))).toBe('not_provisioned');
  });

  it('enforces the domain allow-list and refuses deactivated people', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const admin = await createFirstAdmin(app);
    const id = await createOidcProvider(app, admin.cookie, fake, { allowedDomains: ['acme.dev'] });
    fake.user = { sub: 'sub-eve', email: 'eve@evil.test', emailVerified: true };
    expect(failureOf(await signInWithOidc(app, fake, id))).toBe('domain_not_allowed');

    fake.user = { sub: 'sub-ada', email: 'ada@acme.dev', emailVerified: true };
    const ada = await signInWithOidc(app, fake, id);
    const adaId = (await call(app, 'GET', '/me', { cookie: ada.session })).json().user.id as string;
    await call(app, 'POST', `/users/${adaId}/deactivate`, { cookie: admin.cookie });
    expect(failureOf(await signInWithOidc(app, fake, id))).toBe('deactivated');

    fake.user = { sub: 'sub-nomail' };
    expect(failureOf(await signInWithOidc(app, fake, id))).toBe('email_missing');
  });

  it.for<[string, FakeOidcTampering, string]>([
    ['a wrong issuer', { issuer: 'http://127.0.0.1:1/other' }, 'invalid_response'],
    ['a wrong audience', { audience: 'someone-else' }, 'invalid_response'],
    ['an expired token', { expiresIn: -600 }, 'invalid_response'],
    ['a wrong nonce', { nonce: 'not-the-nonce' }, 'invalid_response'],
    ['a signature from another key', { foreignKey: true }, 'invalid_response'],
    ['an error from the provider', { authorizeError: 'access_denied' }, 'provider_error'],
  ])('refuses %s', async ([, tamper, reason], ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const admin = await createFirstAdmin(app);
    const id = await createOidcProvider(app, admin.cookie, fake);
    fake.tamper = { ...tamper };
    const landing = await signInWithOidc(app, fake, id);
    expect(landing.response.statusCode).toBe(303);
    expect(failureOf(landing)).toBe(reason);
    expect(landing.session).toBeUndefined();
  });

  it('binds the flow to the browser, uses each state once and expires it', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, sql } = harness;
    const admin = await createFirstAdmin(app);
    const id = await createOidcProvider(app, admin.cookie, fake);

    expect(failureOf(await signInWithOidc(app, fake, id, { binding: null }))).toBe(
      'state_mismatch',
    );
    const other = await startSso(app, id);
    expect(failureOf(await signInWithOidc(app, fake, id, { binding: other.binding }))).toBe(
      'state_mismatch',
    );

    const started = await startSso(app, id);
    const callback = fake.authorize(started.location);
    const path = new URL(callback).pathname + new URL(callback).search;
    const first = await app.inject({
      method: 'GET',
      url: path,
      headers: { cookie: started.binding ?? '' },
    });
    expect(first.headers.location).toBe('http://localhost:8080/');
    const replay = await app.inject({
      method: 'GET',
      url: path,
      headers: { cookie: started.binding ?? '' },
    });
    expect(failureOf({ location: String(replay.headers.location) })).toBe('replayed');

    const late = await startSso(app, id);
    await sql`UPDATE auth_sso_flows SET expires_at = now() - interval '1 second' WHERE consumed_at IS NULL`;
    const lateCallback = fake.authorize(late.location);
    const expired = await app.inject({
      method: 'GET',
      url: new URL(lateCallback).pathname + new URL(lateCallback).search,
      headers: { cookie: late.binding ?? '' },
    });
    expect(failureOf({ location: String(expired.headers.location) })).toBe('expired');
  });

  it('never redirects off-site, and replaces the session this browser held', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const admin = await createFirstAdmin(app);
    const id = await createOidcProvider(app, admin.cookie, fake);
    for (const returnTo of [
      'https://evil.test/',
      '//evil.test',
      '/\\evil.test',
      'javascript:alert(1)',
    ]) {
      expect((await signInWithOidc(app, fake, id, { returnTo })).location).toBe(
        'http://localhost:8080/',
      );
    }
    const landing = await signInWithOidc(app, fake, id, { cookie: admin.cookie });
    expect(landing.session).not.toBe(admin.cookie);
    expect((await call(app, 'GET', '/me', { cookie: admin.cookie })).statusCode).toBe(401);
  });

  it('refuses a disabled provider and lists only enabled ones on the sign-in page', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const admin = await createFirstAdmin(app);
    const id = await createOidcProvider(app, admin.cookie, fake);
    const listed = await call(app, 'GET', '/auth/sso/providers');
    expect(listed.json()).toEqual({
      items: [{ id, displayName: 'Acme sign-in', protocol: 'oidc', preset: null }],
      requireSso: false,
    });
    expect(JSON.stringify(listed.json())).not.toContain(fake.clientSecret);
    await call(app, 'PATCH', `/admin/sso/providers/${id}`, {
      cookie: admin.cookie,
      body: { enabled: false },
    });
    expect((await call(app, 'GET', '/auth/sso/providers')).json().items).toEqual([]);
    const started = await startSso(app, id);
    expect(failureOf(started)).toBe('disabled');
  });
});
