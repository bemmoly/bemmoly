import { forgetOidcDiscovery, type DomainEvent } from '@bemmoly/core';
import { startFakeOidcProvider, type FakeOidcProvider } from '@bemmoly/core/testing';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addPerson,
  call,
  createFirstAdmin,
  roleId,
  startHarness,
  type Harness,
} from './harness.ts';
import { bindingCookie, createOidcProvider, pathOf, signInWithOidc } from './sso-support.ts';

/** A passing test sign-in, which requiring SSO asks for first. */
async function passTest(app: FastifyInstance, fake: FakeOidcProvider, cookie: string, id: string) {
  const started = await call(app, 'POST', `/admin/sso/providers/${id}/tests`, { cookie });
  expect(started.statusCode, started.body).toBe(201);
  const callback = fake.authorize(started.json().authorizationUrl);
  await app.inject({
    method: 'GET',
    url: pathOf(callback),
    headers: { cookie: `${bindingCookie(started)}; ${cookie}` },
  });
}

describe('Settings › Sign-in: break-glass admins', () => {
  let harness: Harness | undefined;
  let fake: FakeOidcProvider;
  let skipReason = '';
  const notices: DomainEvent[] = [];

  beforeAll(async () => {
    fake = await startFakeOidcProvider();
    const started = await startHarness();
    if (started.available) {
      harness = started.harness;
      harness.bus.subscribe('notification.requested', (event) => {
        notices.push(event);
      });
    } else skipReason = started.reason;
  });
  afterAll(async () => {
    await harness?.stop();
    await fake.stop();
  });
  beforeEach(async () => {
    notices.length = 0;
    await harness?.reset();
    forgetOidcDiscovery();
    fake.user = { sub: 'sub-ada', email: 'ada@acme.dev', emailVerified: true, name: 'Ada' };
  });

  /** The first admin (break-glass from setup), a second admin and a member. */
  async function workspace(h: Harness) {
    const admin = await createFirstAdmin(h.app);
    const lena = await addPerson(h, admin.cookie, { email: 'lena@acme.dev', role: 'org_admin' });
    const sam = await addPerson(h, admin.cookie, { email: 'sam@acme.dev', role: 'member' });
    const mark = (id: string, cookie = admin.cookie) =>
      call(h.app, 'PUT', `/admin/sso/break-glass-admins/${id}`, { cookie });
    const unmark = (id: string, cookie = admin.cookie) =>
      call(h.app, 'DELETE', `/admin/sso/break-glass-admins/${id}`, { cookie });
    const policy = async () =>
      (await call(h.app, 'GET', '/admin/sso/policy', { cookie: admin.cookie })).json();
    return { admin, lena, sam, mark, unmark, policy };
  }

  it('marks and unmarks an org admin, audits each change and tells the other admins', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { sql } = harness;
    const { admin, lena, mark, unmark, policy } = await workspace(harness);
    const before = await policy();
    expect(before.admins).toEqual([
      expect.objectContaining({ email: 'lena@acme.dev', breakGlass: false, hasPassword: true }),
      expect.objectContaining({ id: admin.userId, breakGlass: true, hasPassword: true }),
    ]);

    const marked = await mark(lena.userId);
    expect(marked.statusCode, marked.body).toBe(200);
    expect(marked.json().breakGlassAdmins.map((entry: { id: string }) => entry.id)).toContain(
      lena.userId,
    );
    expect(notices).toHaveLength(1);
    const payload = notices[0]?.payload as Record<string, unknown>;
    expect(payload).toMatchObject({
      kind: 'break_glass_changed',
      actorId: admin.userId,
      actorName: 'Rohan S.',
      target: { url: '/settings/authentication' },
    });
    // The other admins: Lena herself is an org admin too, and is told; the actor is not.
    expect(payload['recipientIds']).toEqual([lena.userId]);
    expect(String(payload['body'])).toContain('lena is now a break-glass admin');

    expect((await unmark(lena.userId)).statusCode).toBe(204);
    expect((await mark(lena.userId)).statusCode).toBe(200);
    expect((await unmark(lena.userId)).statusCode).toBe(204);
    // Doing it twice changes nothing and tells nobody again.
    expect((await unmark(lena.userId)).statusCode).toBe(204);
    expect(notices).toHaveLength(4);

    const audit = await sql`
      SELECT action, actor_id, after FROM audit_log
      WHERE target_id = ${lena.userId} AND action LIKE 'sso.break_glass%' ORDER BY id`;
    expect(audit.map((row) => row['action'])).toEqual([
      'sso.break_glass_added',
      'sso.break_glass_removed',
      'sso.break_glass_added',
      'sso.break_glass_removed',
    ]);
    expect(audit[0]?.['actor_id']).toBe(admin.userId);
    expect(audit[0]?.['after']).toMatchObject({ isBreakGlass: true, email: 'lena@acme.dev' });
  });

  it('refuses people who cannot be one, and people who may not change it', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const { admin, lena, sam, mark } = await workspace(harness);
    const member = await mark(sam.userId);
    expect(member.statusCode).toBe(409);
    expect(member.json().message).toContain('Only active org admins');
    expect((await mark(lena.userId, sam.cookie)).statusCode).toBe(403);
    expect((await mark('0190a1b2-0000-7000-8000-000000000000')).statusCode).toBe(404);

    // Someone who only ever signed in through the identity provider has no password.
    const id = await createOidcProvider(app, admin.cookie, fake);
    const landing = await signInWithOidc(app, fake, id);
    const ada = (await call(app, 'GET', '/me', { cookie: landing.session })).json().user;
    const promoted = await call(app, 'PATCH', `/users/${ada.id}`, {
      cookie: admin.cookie,
      body: { roleId: await roleId(app, admin.cookie, 'org_admin') },
    });
    expect(promoted.statusCode, promoted.body).toBe(200);
    const listed = (await call(app, 'GET', '/admin/sso/policy', { cookie: admin.cookie })).json();
    expect(listed.admins).toContainEqual(
      expect.objectContaining({ id: ada.id, hasPassword: false }),
    );
    const noPassword = await mark(ada.id);
    expect(noPassword.statusCode).toBe(409);
    expect(noPassword.json().message).toContain('no password to fall back on');
    expect(notices).toHaveLength(0);
  });

  it('always keeps one while single sign-on is required', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const { admin, lena, mark, unmark } = await workspace(harness);
    const id = await createOidcProvider(app, admin.cookie, fake);
    await passTest(app, fake, admin.cookie, id);
    const required = await call(app, 'PUT', '/admin/sso/policy', {
      cookie: admin.cookie,
      body: { requireSso: true },
    });
    expect(required.statusCode, required.body).toBe(200);

    const last = await unmark(admin.userId);
    expect(last.statusCode).toBe(409);
    expect(last.json().message).toBe(
      'Rohan S. is the last break-glass admin. Make someone else one first, or stop requiring single sign-on.',
    );
    expect((await mark(lena.userId)).statusCode).toBe(200);
    expect((await unmark(admin.userId)).statusCode).toBe(204);

    // Lena is now the only one: demoting or deactivating her would leave nobody.
    const demote = await call(app, 'PATCH', `/users/${lena.userId}`, {
      cookie: admin.cookie,
      body: { roleId: await roleId(app, admin.cookie, 'member') },
    });
    expect(demote.statusCode).toBe(409);
    const deactivate = await call(app, 'POST', `/users/${lena.userId}/deactivate`, {
      cookie: admin.cookie,
    });
    expect(deactivate.statusCode).toBe(409);
    expect(deactivate.json().message).toContain('lena is the last break-glass admin');

    // Two admins unmarking the last two at once: one wins, one is refused.
    expect((await mark(admin.userId)).statusCode).toBe(200);
    const [first, second] = await Promise.all([unmark(admin.userId), unmark(lena.userId)]);
    expect([first.statusCode, second.statusCode].sort()).toEqual([204, 409]);
    const left = (await call(app, 'GET', '/admin/sso/policy', { cookie: admin.cookie })).json();
    expect(left.breakGlassAdmins).toHaveLength(1);

    // Without the requirement the last one may go, and a demoted admin stops being one.
    await call(app, 'PUT', '/admin/sso/policy', {
      cookie: admin.cookie,
      body: { requireSso: false },
    });
    const keeper = left.breakGlassAdmins[0].id as string;
    expect((await unmark(keeper)).statusCode).toBe(204);
    expect((await mark(lena.userId)).statusCode).toBe(200);
    const demoted = await call(app, 'PATCH', `/users/${lena.userId}`, {
      cookie: admin.cookie,
      body: { roleId: await roleId(app, admin.cookie, 'member') },
    });
    expect(demoted.statusCode, demoted.body).toBe(200);
    expect(demoted.json().isBreakGlass).toBe(false);
  });
});
