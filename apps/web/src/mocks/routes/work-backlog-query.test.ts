import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';

/* The Backlog read's query and sort rules, answered as the server's backlog service does. */

const W = 'http://mock.local/api/v1/work/projects/PLT/backlog';

interface Answer {
  issues: Array<{ key: string; priority: string }>;
  sorted: boolean;
}

const read = (api: ReturnType<typeof createMockApi>, query = '') =>
  api.dispatch('GET', `${W}${query}`, undefined);

describe('the backlog query mock', () => {
  it('keeps rank order without a query and sorts by its ORDER BY with one', () => {
    const api = createMockApi('ready');
    const plain = read(api)?.body as Answer;
    expect(plain.sorted).toBe(false);
    const sorted = read(api, `?q=${encodeURIComponent('ORDER BY priority DESC')}`)?.body as Answer;
    expect(sorted.sorted).toBe(true);
    const order = ['highest', 'high', 'medium', 'low', 'lowest'];
    const ranks = sorted.issues.map((issue) => order.indexOf(issue.priority));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(sorted.issues.length).toBe(plain.issues.length);
  });

  it('filters by the WHERE and refuses a query that does not parse', () => {
    const api = createMockApi('ready');
    const high = read(api, `?q=${encodeURIComponent('priority = High')}`)?.body as Answer;
    expect(high.issues.every((issue) => issue.priority === 'high')).toBe(true);
    expect(read(api, `?q=${encodeURIComponent('status = ')}`)?.status).toBe(400);
  });
});
