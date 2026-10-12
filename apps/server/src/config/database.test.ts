import { describe, expect, it } from 'vitest';
import { jobHandlerLimit, poolSize } from './database.ts';

describe('the database pool size', () => {
  it('keeps 10 on small machines, four per CPU above that, and 40 at most', () => {
    expect(poolSize({}, 1)).toBe(10);
    expect(poolSize({}, 2)).toBe(10);
    expect(poolSize({}, 4)).toBe(16);
    expect(poolSize({}, 8)).toBe(32);
    expect(poolSize({}, 64)).toBe(40);
  });

  it('takes BEMMOLY_DB_POOL_MAX over the CPU count', () => {
    expect(poolSize({ BEMMOLY_DB_POOL_MAX: 6 }, 64)).toBe(6);
    expect(poolSize({ BEMMOLY_DB_POOL_MAX: 80 }, 2)).toBe(80);
  });

  it('leaves jobs a little under half of a shared pool and keeps two back on a worker', () => {
    expect(jobHandlerLimit('all', 10)).toBe(4);
    expect(jobHandlerLimit('all', 32)).toBe(15);
    expect(jobHandlerLimit('worker', 10)).toBe(8);
    expect(jobHandlerLimit('all', 2)).toBe(1);
  });
});
