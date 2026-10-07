import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  addPerson,
  call,
  createFirstAdmin,
  linkToken,
  roleId,
  sessionCookie,
  startHarness,
  type Harness,
} from './harness.ts';

describe('API tokens, invitations and password reset against a real database', () => {
  let harness: Harness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });
  afterAll(async () => harness?.stop());
  beforeEach(async () => harness?.reset());

  it('issues a token once, accepts it only as Bearer, and honours scope and revocation', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, sql } = harness;
    const { cookie } = await createFirstAdmin(app);
    const created = await call(app, 'POST', '/api-tokens', {
      cookie,
      body: { name: 'CI', scopes: ['read'] },
    });
    expect(created.statusCode).toBe(201);
    const { token, apiToken } = created.json();
    expect(token).toMatch(/^bmy_[A-Za-z0-9_-]{43}$/);
    expect(apiToken.prefix).toBe(token.slice(0, 12));
    const listed = await call(app, 'GET', '/api-tokens', { cookie });
    expect(JSON.stringify(listed.json())).not.toContain(token);
    const [row] = await sql<{ token_hash: string }[]>`select token_hash from api_tokens`;
    expect(row?.token_hash).not.toBe(token);

    const me = await call(app, 'GET', '/me', { token, origin: null });
    expect(me.statusCode).toBe(200);
    const [used] = await sql<
      { used: boolean }[]
    >`select last_used_at is not null as used from api_tokens`;
    expect(used?.used).toBe(true);

    const asCookie = await call(app, 'GET', '/me', { cookie: `bemmoly_session=${token}` });
    expect(asCookie.statusCode).toBe(401);
    const write = await call(app, 'POST', '/teams', {
      token,
      origin: null,
      body: { name: 'Platform' },
    });
    expect(write.statusCode).toBe(403);
    expect(
      (await call(app, 'POST', '/api-tokens', { token, body: { name: 'x', scopes: ['read'] } }))
        .statusCode,
    ).toBe(403);

    await call(app, 'DELETE', `/api-tokens/${apiToken.id}`, { cookie });
    expect((await call(app, 'GET', '/me', { token })).statusCode).toBe(401);
  });

  it('lets a write token mutate under the owner capabilities', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const { cookie } = await createFirstAdmin(app);
    const { token } = (
      await call(app, 'POST', '/api-tokens', {
        cookie,
        body: { name: 'bot', scopes: ['read', 'write'] },
      })
    ).json();
    const team = await call(app, 'POST', '/teams', {
      token,
      origin: null,
      body: { name: 'Platform' },
    });
    expect(team.statusCode).toBe(201);
    const [audit] = await harness.sql<{ actor_kind: string; actor_user_id: string }[]>`
      select actor_kind, actor_user_id from audit_log where action = 'team.created'`;
    expect(audit?.actor_kind).toBe('api_token');
    expect(audit?.actor_user_id).toBeTruthy();
  });

  it('invites with a role and team, publishes the email event, and accepts once', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, events } = harness;
    const { cookie } = await createFirstAdmin(app);
    const team = (await call(app, 'POST', '/teams', { cookie, body: { name: 'Platform' } })).json();
    const viewer = await roleId(app, cookie, 'viewer');
    const invited = await call(app, 'POST', '/invitations', {
      cookie,
      body: { emails: ['Sam@AcmeLabs.dev', 'lena@acmelabs.dev'], roleId: viewer, teamId: team.id },
    });
    expect(invited.statusCode).toBe(201);
    expect(invited.json().items.map((item: { email: string }) => item.email)).toEqual([
      'sam@acmelabs.dev',
      'lena@acmelabs.dev',
    ]);
    expect(events).toHaveLength(2);
    const payload = events[0]?.payload as Record<string, string>;
    expect(events[0]?.kind).toBe('invitation.created');
    expect(Object.keys(payload).sort()).toEqual([
      'acceptUrl',
      'email',
      'expiresAt',
      'invitationId',
      'inviterName',
    ]);
    expect(payload).toMatchObject({ email: 'sam@acmelabs.dev', inviterName: 'Rohan S.' });
    expect(payload['expiresAt']).toBeInstanceOf(Date);
    expect(payload['acceptUrl']).toMatch(/^http:\/\/localhost:8080\/invitations\/[\w-]{43}$/);
    expect(events[0]?.transaction).toBeDefined();
    const token = linkToken(payload['acceptUrl'] ?? '');

    const preview = await call(app, 'GET', `/auth/invitations/${token}`);
    expect(preview.json()).toMatchObject({ email: 'sam@acmelabs.dev', roleName: 'Viewer' });
    const accepted = await call(app, 'POST', `/auth/invitations/${token}/accept`, {
      body: { name: 'Sam R.', password: 'short' },
    });
    expect(accepted.statusCode).toBe(400);
    const ok = await call(app, 'POST', `/auth/invitations/${token}/accept`, {
      body: { name: 'Sam R.', password: 'twelve chars ok' },
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().user).toMatchObject({ roleId: viewer, teamIds: [team.id], status: 'active' });
    expect(sessionCookie(ok)).toBeDefined();
    const reuse = await call(app, 'POST', `/auth/invitations/${token}/accept`, {
      body: { name: 'Mallory', password: 'twelve chars ok' },
    });
    expect(reuse.statusCode).toBe(404);

    const existing = await call(app, 'POST', '/invitations', {
      cookie,
      body: { emails: ['sam@acmelabs.dev'], roleId: viewer },
    });
    expect(existing.statusCode).toBe(409);
    const pending = (await call(app, 'GET', '/invitations', { cookie })).json().items;
    expect(pending.map((item: { email: string }) => item.email)).toEqual(['lena@acmelabs.dev']);
  });

  it('lets only org admins invite another org admin', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const { cookie: admin } = await createFirstAdmin(app);
    const member = await addPerson(harness, admin, { email: 'aisha@acmelabs.dev', role: 'member' });
    const orgAdmin = await roleId(app, admin, 'org_admin');
    const denied = await call(app, 'POST', '/invitations', {
      cookie: member.cookie,
      body: { emails: ['x@acmelabs.dev'], roleId: orgAdmin },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().code).toBe('forbidden');
  });

  it('resets a password through a one-time link and signs out everywhere', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, events } = harness;
    const { cookie } = await createFirstAdmin(app);
    const unknown = await call(app, 'POST', '/auth/password-reset', {
      body: { email: 'nobody@acmelabs.dev' },
    });
    expect(unknown.statusCode).toBe(202);
    expect(events).toHaveLength(0);
    const known = await call(app, 'POST', '/auth/password-reset', { body: { email: ADMIN.email } });
    expect(known.statusCode).toBe(202);
    expect(events[0]?.kind).toBe('password_reset.requested');
    const reset = events[0]?.payload as Record<string, unknown>;
    expect(Object.keys(reset).sort()).toEqual([
      'email',
      'expiresAt',
      'name',
      'resetId',
      'resetUrl',
      'userId',
    ]);
    expect(reset['resetUrl']).toMatch(/^http:\/\/localhost:8080\/password-reset\/[\w-]{43}$/);
    expect(events[0]?.transaction).toBeDefined();
    const token = linkToken(String(reset['resetUrl']));

    const done = await call(app, 'POST', '/auth/password-reset/complete', {
      body: { token, password: 'a brand new passphrase' },
    });
    expect(done.statusCode).toBe(204);
    expect((await call(app, 'GET', '/me', { cookie })).statusCode).toBe(401);
    const again = await call(app, 'POST', '/auth/password-reset/complete', {
      body: { token, password: 'another new passphrase' },
    });
    expect(again.statusCode).toBe(400);
    const old = await call(app, 'POST', '/auth/login', { body: ADMIN });
    expect(old.statusCode).toBe(401);
    const fresh = await call(app, 'POST', '/auth/login', {
      body: { email: ADMIN.email, password: 'a brand new passphrase' },
    });
    expect(fresh.statusCode).toBe(200);
  });
});
