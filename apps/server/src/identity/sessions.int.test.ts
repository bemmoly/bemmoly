import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  addPerson,
  call,
  createFirstAdmin,
  roleId,
  sessionCookie,
  startHarness,
  type Harness,
} from './harness.ts';

describe('setup, sign-in and sessions against a real database', () => {
  let harness: Harness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });
  afterAll(async () => harness?.stop());
  beforeEach(async () => harness?.reset());

  it('creates the first admin exactly once and reports setup status', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    expect((await call(app, 'GET', '/setup/status')).json()).toEqual({
      initialized: false,
      completedAt: null,
    });

    const created = await call(app, 'POST', '/setup/admin', {
      body: { workspaceName: 'Acme', workspaceUrl: 'https://a.test', name: 'Rohan', ...ADMIN },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().user).toMatchObject({ email: ADMIN.email, isBreakGlass: true });
    const setCookie = String(created.headers['set-cookie']);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(setCookie).toMatch(/Max-Age=25919\d\d|Max-Age=2592000/);
    expect((await call(app, 'GET', '/setup/status')).json()).toEqual({
      initialized: true,
      completedAt: null,
    });

    const again = await call(app, 'POST', '/setup/admin', {
      body: { workspaceName: 'X', workspaceUrl: 'https://x.test', name: 'Eve', ...ADMIN },
    });
    expect(again.statusCode).toBe(409);
    expect(again.json().code).toBe('conflict');
    const [users] = await harness.sql<{ count: number }[]>`select count(*)::int from users`;
    expect(users?.count).toBe(1);
  });

  it('allows only one of two concurrent setup attempts', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const body = (email: string) => ({
      workspaceName: 'Acme',
      workspaceUrl: 'https://a.test',
      name: 'Admin',
      email,
      password: ADMIN.password,
    });
    const results = await Promise.all([
      call(harness.app, 'POST', '/setup/admin', { body: body('one@a.test') }),
      call(harness.app, 'POST', '/setup/admin', { body: body('two@a.test') }),
    ]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([201, 409]);
  });

  it('signs in, serves /me, and signs out', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    await createFirstAdmin(app);
    const wrong = await call(app, 'POST', '/auth/login', {
      body: { email: ADMIN.email, password: 'not the password' },
    });
    const unknown = await call(app, 'POST', '/auth/login', {
      body: { email: 'nobody@acmelabs.dev', password: 'not the password' },
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json().message).toBe(unknown.json().message);

    const login = await call(app, 'POST', '/auth/login', {
      body: { email: ADMIN.email.toUpperCase(), password: ADMIN.password },
    });
    expect(login.statusCode).toBe(200);
    const cookie = sessionCookie(login);
    const me = await call(app, 'GET', '/me', { cookie });
    expect(me.statusCode).toBe(200);
    expect(me.json().capabilities).toContain('workspace.roles.manage');
    expect(me.json().modules).toEqual(['sample']);

    const [stored] = await harness.sql<{ token_hash: string }[]>`select token_hash from sessions`;
    expect(cookie).not.toContain(stored?.token_hash);
    expect(stored?.token_hash).toMatch(/^[0-9a-f]{64}$/);

    const logout = await call(app, 'POST', '/auth/logout', { cookie, body: {} });
    expect(logout.statusCode).toBe(204);
    expect(String(logout.headers['set-cookie'])).toMatch(/Max-Age=0/);
    expect((await call(app, 'GET', '/me', { cookie })).statusCode).toBe(401);
  });

  it('closes every API route to anonymous callers except the anonymous ones', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    for (const url of ['/me', '/users', '/roles', '/audit-log', '/module-grants', '/modules']) {
      const response = await call(app, 'GET', url);
      expect(response.statusCode, url).toBe(401);
      expect(response.json().code).toBe('unauthenticated');
    }
    expect((await call(app, 'GET', '/setup/status')).statusCode).toBe(200);
    expect((await app.inject({ url: '/healthz' })).statusCode).toBe(200);
  });

  it('signs out everywhere and lists only live sessions', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const { cookie: first } = await createFirstAdmin(app);
    const login = await call(app, 'POST', '/auth/login', { body: ADMIN });
    const second = sessionCookie(login);
    const sessions = await call(app, 'GET', '/sessions', { cookie: second });
    expect(sessions.json().items).toHaveLength(2);
    expect(sessions.json().items.filter((item: { current: boolean }) => item.current)).toHaveLength(
      1,
    );

    await call(app, 'POST', '/auth/logout', { cookie: second, body: { everywhere: true } });
    expect((await call(app, 'GET', '/me', { cookie: first })).statusCode).toBe(401);
    expect((await call(app, 'GET', '/me', { cookie: second })).statusCode).toBe(401);
  });

  it('rotates the session token after a privilege change and keeps the old one briefly', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const { cookie: admin } = await createFirstAdmin(app);
    const member = await addPerson(harness, admin, { email: 'aisha@acmelabs.dev', role: 'member' });
    const promoted = await call(app, 'PATCH', `/users/${member.userId}`, {
      cookie: admin,
      body: { roleId: await roleId(app, admin, 'project_admin') },
    });
    expect(promoted.statusCode).toBe(200);

    const next = await call(app, 'GET', '/me', { cookie: member.cookie });
    expect(next.statusCode).toBe(200);
    const rotated = sessionCookie(next);
    expect(rotated).toBeDefined();
    expect(rotated).not.toBe(member.cookie);
    expect((await call(app, 'GET', '/me', { cookie: rotated })).statusCode).toBe(200);
    // In-flight requests holding the old token still work during the grace window.
    expect((await call(app, 'GET', '/me', { cookie: member.cookie })).statusCode).toBe(200);
  });

  it('refuses a deactivated person and keeps the last org admin', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const { cookie: admin, userId: adminId } = await createFirstAdmin(app);
    const member = await addPerson(harness, admin, { email: 'jonas@acmelabs.dev', role: 'member' });
    const off = await call(app, 'POST', `/users/${member.userId}/deactivate`, { cookie: admin });
    expect(off.json().status).toBe('deactivated');
    expect((await call(app, 'GET', '/me', { cookie: member.cookie })).statusCode).toBe(401);
    const login = await call(app, 'POST', '/auth/login', {
      body: { email: 'jonas@acmelabs.dev', password: 'a long enough password' },
    });
    expect(login.statusCode).toBe(401);

    const demote = await call(app, 'PATCH', `/users/${adminId}`, {
      cookie: admin,
      body: { roleId: await roleId(app, admin, 'member') },
    });
    expect(demote.statusCode).toBe(409);
    const self = await call(app, 'POST', `/users/${adminId}/deactivate`, { cookie: admin });
    expect(self.statusCode).toBe(409);
  });
});
