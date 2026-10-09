import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, createFirstAdmin, startHarness, type Harness } from './harness.ts';

const SPRAYER = '198.51.100.7';
const OFFICE = '203.0.113.20';
const unknownToken = (index: number) => `bmy_${String(index).padStart(43, 'q')}`;

describe('refused credentials per address, checked before authentication', () => {
  let harness: Harness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });
  afterAll(async () => harness?.stop());
  beforeEach(async () => harness?.reset());

  it('turns away an address that keeps presenting unknown API tokens', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.newApp({ BEMMOLY_RATE_LIMIT_FAILED_CREDENTIALS_PER_IP: 3 });
    const { cookie } = await createFirstAdmin(app);
    const created = await call(app, 'POST', '/api-tokens', {
      cookie,
      body: { name: 'script', scopes: ['read'] },
    });
    const { token } = created.json() as { token: string };
    const spray = (index: number) =>
      call(app, 'GET', '/me', { token: unknownToken(index), remoteAddress: SPRAYER });
    for (const index of [1, 2, 3]) expect((await spray(index)).statusCode).toBe(401);

    const limited = await spray(4);
    expect(limited.statusCode).toBe(429);
    expect(limited.json().code).toBe('rate_limited');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    // Refused before the lookup: even a valid token from that address waits.
    expect((await call(app, 'GET', '/me', { token, remoteAddress: SPRAYER })).statusCode).toBe(429);
    expect((await call(app, 'GET', '/me', { token, remoteAddress: OFFICE })).statusCode).toBe(200);
    expect((await call(app, 'GET', '/setup/status', { remoteAddress: SPRAYER })).statusCode).toBe(
      200,
    );
  });

  it('counts refused session cookies, never accepted ones', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.newApp({ BEMMOLY_RATE_LIMIT_FAILED_CREDENTIALS_PER_IP: 3 });
    const { cookie } = await createFirstAdmin(app);
    for (let index = 0; index < 5; index += 1) {
      expect((await call(app, 'GET', '/me', { cookie, remoteAddress: OFFICE })).statusCode).toBe(
        200,
      );
    }
    const stale = `bemmoly_session=${'s'.repeat(43)}`;
    for (let index = 0; index < 3; index += 1) {
      const response = await call(app, 'GET', '/me', { cookie: stale, remoteAddress: OFFICE });
      expect(response.statusCode).toBe(401);
      expect(String(response.headers['set-cookie'])).toContain('bemmoly_session=;');
    }
    expect((await call(app, 'GET', '/me', { cookie, remoteAddress: OFFICE })).statusCode).toBe(429);
  });

  it('keeps the default budget for an install that sets none', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, sql } = harness;
    await call(app, 'GET', '/me', { token: unknownToken(1), remoteAddress: SPRAYER });
    const [bucket] = await sql<{ count: number }[]>`
      select count from rate_limit_buckets where key = ${`credentials|ip:${SPRAYER}`}`;
    expect(bucket?.count).toBe(1);
    for (let index = 2; index <= 59; index += 1) {
      await call(app, 'GET', '/me', { token: unknownToken(index), remoteAddress: SPRAYER });
    }
    expect((await call(app, 'GET', '/me', { token: unknownToken(60) })).statusCode).toBe(401);
    expect(
      (await call(app, 'GET', '/me', { token: unknownToken(60), remoteAddress: SPRAYER }))
        .statusCode,
    ).toBe(401);
    expect(
      (await call(app, 'GET', '/me', { token: unknownToken(61), remoteAddress: SPRAYER }))
        .statusCode,
    ).toBe(429);
  });
});
