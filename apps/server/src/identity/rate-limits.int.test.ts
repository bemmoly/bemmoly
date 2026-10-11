import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, call, createFirstAdmin, startHarness, type Harness } from './harness.ts';

/** One address per attempt, as a botnet would spread them; the per-IP budget never trips. */
const fromIp = (index: number) => `10.0.${Math.floor(index / 250)}.${(index % 250) + 1}`;

async function attempts(
  count: number,
  send: (remoteAddress: string) => ReturnType<typeof call>,
): Promise<number[]> {
  const statuses: number[] = [];
  for (let index = 0; index < count; index += 1) {
    statuses.push((await send(fromIp(index))).statusCode);
  }
  return statuses;
}

describe('per-account budgets on the anonymous auth routes, against a real database', () => {
  let harness: Harness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });
  afterAll(async () => harness?.stop());
  beforeEach(async () => harness?.reset());

  it('stops password guessing for one account spread over many addresses', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    await createFirstAdmin(app);
    const guess = (remoteAddress: string, email = ADMIN.email) =>
      call(app, 'POST', '/auth/login', {
        body: { email, password: 'wrong password' },
        remoteAddress,
      });
    expect(new Set(await attempts(10, (ip) => guess(ip)))).toEqual(new Set([401]));
    const limited = await guess('192.0.2.1', ` ${ADMIN.email.toUpperCase()} `);
    expect(limited.statusCode).toBe(429);
    expect(limited.json().code).toBe('rate_limited');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(14 * 60);
    const right = await call(app, 'POST', '/auth/login', {
      body: ADMIN,
      remoteAddress: '192.0.2.2',
    });
    expect(right.statusCode).toBe(429);
    expect((await guess('192.0.2.3', 'maya@acmelabs.dev')).statusCode).toBe(401);
  });

  it('caps reset emails to one address and link attempts per token', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    await createFirstAdmin(app);
    const reset = (remoteAddress: string) =>
      call(app, 'POST', '/auth/password-reset', { body: { email: ADMIN.email }, remoteAddress });
    expect(new Set(await attempts(10, reset))).toEqual(new Set([202]));
    expect((await reset('192.0.2.1')).statusCode).toBe(429);

    const token = 'x'.repeat(43);
    const accept = (remoteAddress: string) =>
      call(app, 'POST', `/auth/invitations/${token}/accept`, {
        body: { name: 'Maya', password: 'a long enough password' },
        remoteAddress,
      });
    const complete = (remoteAddress: string) =>
      call(app, 'POST', '/auth/password-reset/complete', {
        body: { token, password: 'a long enough password' },
        remoteAddress,
      });
    for (const send of [accept, complete]) {
      expect((await attempts(10, send)).includes(429)).toBe(false);
      expect((await send('192.0.2.1')).statusCode).toBe(429);
    }
  });

  it('keeps no address or link token in the bucket keys', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, sql } = harness;
    await call(app, 'POST', '/auth/login', { body: { email: ADMIN.email, password: 'x' } });
    await call(app, 'POST', `/auth/invitations/${'y'.repeat(43)}/accept`, { body: {} });
    const keys = (await sql<{ key: string }[]>`select key from rate_limit_buckets`).map(
      (row) => row.key,
    );
    expect(keys.filter((key) => key.startsWith('account|'))).toHaveLength(2);
    expect(keys.join('\n')).not.toMatch(/rohan|acmelabs|yyyy/i);
  });

  it('takes the per-account maximum from the environment', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.newApp({ BEMMOLY_RATE_LIMIT_AUTH_PER_ACCOUNT: 3 });
    await createFirstAdmin(app);
    const guess = (remoteAddress: string) =>
      call(app, 'POST', '/auth/login', {
        body: { email: 'nobody@acmelabs.dev', password: 'wrong password' },
        remoteAddress,
      });
    expect(await attempts(4, guess)).toEqual([401, 401, 401, 429]);
  });
});
