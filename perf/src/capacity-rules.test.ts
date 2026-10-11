import { describe, expect, it } from 'vitest';
import { activeUsers, companySize, stepVerdict } from './capacity-rules.ts';

const route = (name: string, p95: number) => ({ route: name, count: 100, p95, p99: p95 * 2 });

describe('capacity rules', () => {
  it('turns actions a second into people', () => {
    expect(activeUsers(40)).toBe(600);
    expect(companySize(40)).toBe(3000);
  });

  it('judges a step by its worst budget and its errors', () => {
    const board = 'GET /api/v1/work/boards/:id/view';
    const ok = { errorRate: 0, routes: [route(board, 60)], collabPageOpenP95: 40 };
    expect(stepVerdict(ok)).toBe('within');
    expect(stepVerdict({ ...ok, routes: [route(board, 90)] })).toBe('degraded');
    expect(stepVerdict({ ...ok, errorRate: 0.002 })).toBe('degraded');
    expect(stepVerdict({ ...ok, collabPageOpenP95: 700 })).toBe('broken');
    expect(stepVerdict({ ...ok, errorRate: 0.02 })).toBe('broken');
    expect(stepVerdict({ ...ok, routes: [route('PATCH /api/v1/work/issues/:key', 900)] })).toBe(
      'within',
    );
  });
});
