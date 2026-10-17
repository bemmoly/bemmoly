import {
  authenticateRequest,
  authentication,
  createUserDirectory,
  rateLimiting,
  type SqlExecutor,
} from '@bemmoly/core';
import Fastify from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { errorHandler } from '../middlewares/error-handler.ts';
import {
  addPerson,
  call,
  createFirstAdmin,
  roleId,
  startHarness,
  type Harness,
} from './harness.ts';

describe('what email and notifications build on, against a real database', () => {
  let harness: Harness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });
  afterAll(async () => harness?.stop());
  beforeEach(async () => harness?.reset());

  const invite = async (h: Harness, cookie: string, email: string) =>
    call(h.app, 'POST', '/invitations', {
      cookie,
      body: { emails: [email], roleId: await roleId(h.app, cookie, 'member'), message: 'Welcome' },
    });

  it('hands handlers the open transaction, so their writes commit with the invitation', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { cookie } = await createFirstAdmin(harness.app);
    const stop = harness.bus.subscribe('invitation.created', async (event) => {
      const tx = event.transaction as SqlExecutor;
      await tx`insert into audit_log (actor_kind, action, target_kind) values ('system', 'test.outbox', 'email')`;
    });
    try {
      const response = await invite(harness, cookie, 'lena@acmelabs.dev');
      expect(response.statusCode).toBe(201);
    } finally {
      stop();
    }
    expect((harness.events[0]?.payload as { message?: string }).message).toBe('Welcome');
    const [row] = await harness.sql<{ count: number }[]>`
      select count(*)::int from audit_log where action = 'test.outbox'`;
    expect(row?.count).toBe(1);
  });

  it('rolls the invitation back when a handler fails', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { cookie } = await createFirstAdmin(harness.app);
    const stop = harness.bus.subscribe('invitation.created', () => {
      throw new Error('outbox unavailable');
    });
    try {
      const response = await invite(harness, cookie, 'jonas@acmelabs.dev');
      expect(response.statusCode).toBe(500);
    } finally {
      stop();
    }
    const [row] = await harness.sql<{ count: number }[]>`select count(*)::int from invitations`;
    expect(row?.count).toBe(0);
  });

  it('looks people up by id for addressing, flagging deactivated ones', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, identity } = harness;
    const { cookie, userId: adminId } = await createFirstAdmin(app);
    const member = await addPerson(harness, cookie, { email: 'maya@acmelabs.dev', role: 'member' });
    await call(app, 'POST', `/users/${member.userId}/deactivate`, { cookie });
    const found = await createUserDirectory(identity.db).findByIds([
      adminId,
      member.userId,
      '01900000-0000-7000-8000-00000000dead',
      'not-an-id',
    ]);
    expect(found.sort((a, b) => a.email.localeCompare(b.email))).toEqual([
      { id: member.userId, email: 'maya@acmelabs.dev', name: 'maya', active: false },
      { id: adminId, email: 'rohan@acmelabs.dev', name: 'Rohan S.', active: true },
    ]);
  });

  it('keeps unsubscribe links anonymous but strictly limited, and serves authenticateRequest', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { identity } = harness;
    const { cookie } = await createFirstAdmin(harness.app);
    const app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    await app.register(authentication, identity);
    await app.register(rateLimiting, {
      sql: identity.sql,
      strictPerIp: { max: 2, windowMs: 60_000 },
    });
    app.get('/api/v1/email-unsubscriptions', async () => ({ ok: true }));
    app.get('/api/v1/explicit', async (request) => ({ actor: await authenticateRequest(request) }));
    try {
      const open = () => app.inject({ url: '/api/v1/email-unsubscriptions?token=abcdefghijk' });
      expect((await open()).statusCode).toBe(200);
      expect((await open()).statusCode).toBe(200);
      expect((await open()).statusCode).toBe(429);
      expect((await app.inject({ url: '/api/v1/explicit' })).statusCode).toBe(401);
      const signedIn = await app.inject({ url: '/api/v1/explicit', headers: { cookie } });
      expect(signedIn.json().actor.kind).toBe('user');
    } finally {
      await app.close();
    }
  });

  it('leaves a foreign Bearer header on an anonymous route to the route', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    await app.register(authentication, harness.identity);
    app.post('/api/v1/ci', { config: { anonymous: true } }, async (request) => ({
      actor: request.actor,
      header: request.headers.authorization,
    }));
    app.post('/api/v1/closed', async () => ({ ok: true }));
    try {
      const headers = { authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.e30.c2ln' };
      const open = await app.inject({ method: 'POST', url: '/api/v1/ci', headers });
      expect(open.statusCode).toBe(200);
      expect(open.json()).toEqual({ actor: null, header: headers.authorization });
      // A session cookie riding along never turns the foreign token's request into a person's.
      const { cookie } = await createFirstAdmin(harness.app);
      const both = await app.inject({
        method: 'POST',
        url: '/api/v1/ci',
        headers: { ...headers, cookie },
      });
      expect(both.json()).toEqual({ actor: null, header: headers.authorization });
      const closed = await app.inject({ method: 'POST', url: '/api/v1/closed', headers });
      expect(closed.statusCode).toBe(401);
      // Bemmoly's own tokens are still read there, so a revoked one is refused.
      const kernel = { authorization: 'Bearer bmy_not-a-real-token-0000000000' };
      const refused = await app.inject({ method: 'POST', url: '/api/v1/ci', headers: kernel });
      expect(refused.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('never turns a runner away for refused cookies from the same address', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    await app.register(rateLimiting, {
      sql: harness.identity.sql,
      failedCredentialsPerIp: { max: 2, windowMs: 60_000 },
    });
    await app.register(authentication, harness.identity);
    app.post('/api/v1/runner/claims', { config: { anonymous: true } }, async () => ({ ok: true }));
    app.get('/api/v1/me', async () => ({ ok: true }));
    try {
      const stale = { cookie: 'bemmoly_session=expired-in-another-database' };
      const read = () => app.inject({ url: '/api/v1/me', headers: stale });
      expect((await read()).statusCode).toBe(401);
      expect((await read()).statusCode).toBe(401);
      expect((await read()).statusCode).toBe(429);
      // The runner's pool token is checked by its route, under that route's own budget.
      const runner = { authorization: 'Bearer bpr_pool-token-from-the-same-address' };
      const claim = await app.inject({
        method: 'POST',
        url: '/api/v1/runner/claims',
        headers: runner,
      });
      expect(claim.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('keeps the boot read of setup status out of the strict per-IP budget', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    await app.register(rateLimiting, {
      sql: harness.identity.sql,
      strictPerIp: { max: 2, windowMs: 60_000 },
    });
    app.get('/api/v1/setup/status', async () => ({ initialized: true }));
    app.post('/api/v1/setup/admin', async () => ({ ok: true }));
    try {
      for (let load = 0; load < 5; load += 1) {
        expect((await app.inject({ url: '/api/v1/setup/status' })).statusCode).toBe(200);
      }
      const create = () => app.inject({ method: 'POST', url: '/api/v1/setup/admin' });
      expect((await create()).statusCode).toBe(200);
      expect((await create()).statusCode).toBe(200);
      expect((await create()).statusCode).toBe(429);
    } finally {
      await app.close();
    }
  });

  it('gives each route that calls a model its own, smaller per-person budget', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    await app.register(rateLimiting, {
      sql: harness.identity.sql,
      perActor: { max: 50, windowMs: 60_000 },
      aiPerActor: { max: 2, windowMs: 60_000 },
    });
    app.post('/api/v1/ai/answers', async () => ({ ok: true }));
    app.post('/api/v1/docs/pages/:pageId/completions', async () => ({ ok: true }));
    app.get('/api/v1/work/issues', async () => ({ ok: true }));
    try {
      const ask = () => app.inject({ method: 'POST', url: '/api/v1/ai/answers' });
      expect((await ask()).statusCode).toBe(200);
      expect((await ask()).statusCode).toBe(200);
      const refused = await ask();
      expect(refused.statusCode).toBe(429);
      expect(refused.json().code).toBe('rate_limited');
      const ghost = () => app.inject({ method: 'POST', url: '/api/v1/docs/pages/p1/completions' });
      expect((await ghost()).statusCode).toBe(200);
      for (let read = 0; read < 5; read += 1) {
        expect((await app.inject({ url: '/api/v1/work/issues' })).statusCode).toBe(200);
      }
    } finally {
      await app.close();
    }
  });
});
