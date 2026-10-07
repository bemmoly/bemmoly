import { describe, expect, it } from 'vitest';
import { checkReadiness } from './readiness.ts';

describe('checkReadiness', () => {
  it('is degraded when no database is configured', async () => {
    expect(await checkReadiness({})).toEqual({
      status: 'degraded',
      checks: { database: { status: 'skipped', message: 'DATABASE_URL is not set' } },
    });
  });

  it('is ready when the database answers', async () => {
    const result = await checkReadiness({ database: { ping: async () => undefined } });
    expect(result.status).toBe('ready');
    expect(result.checks.database.status).toBe('ok');
  });

  it('is unavailable when the database fails, without leaking the error', async () => {
    const result = await checkReadiness({
      database: {
        ping: async () => {
          throw new Error('password authentication failed for user "bemmoly"');
        },
      },
    });
    expect(result).toEqual({
      status: 'unavailable',
      checks: { database: { status: 'failed', message: 'Database is not reachable' } },
    });
  });
});
