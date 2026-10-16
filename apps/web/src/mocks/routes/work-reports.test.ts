import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';

/*
 * The Reports mock behind the public demo: every report answers for Platform Core, and every
 * id in it is a UUID, since the screen validates the replies and refuses the page otherwise.
 */

const W = '/api/v1/work';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Every value under a key ending in "id"/"Id" that is meant to be a UUID. */
function ids(value: unknown, key = ''): unknown[] {
  if (Array.isArray(value)) return value.flatMap((item) => ids(item, key));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([name, item]) => ids(item, name));
  }
  return /(^id|Id)$/.test(key) && value !== null && key !== 'id' ? [value] : [];
}

const get = (api: ReturnType<typeof createMockApi>, url: string) => {
  const response = api.dispatch('GET', url, undefined);
  expect(response?.status, url).toBe(200);
  return response?.body as Record<string, unknown>;
};

describe('work reports mock', () => {
  const api = createMockApi('ready');
  const sprints = (
    get(api, `${W}/projects/PLT/sprints`)['items'] as Record<string, unknown>[]
  ).filter((sprint) => sprint['startedAt']);

  it('answers a started sprint with a report and a run of closed sprints', () => {
    const report = get(api, `${W}/sprints/${String(sprints[0]?.['id'])}/report`);
    const velocity = report['velocity'] as { sprintId: string; name: string }[];
    expect(velocity.length).toBeGreaterThanOrEqual(5);
    expect(velocity.every((point) => UUID.test(point.sprintId))).toBe(true);
    expect((report['burnup'] as unknown[]).length).toBeGreaterThan(0);
    expect(ids(report).every((id) => UUID.test(String(id)))).toBe(true);
  });

  it.each([
    'flow?days=30',
    'control?days=30',
    'time-in-status?days=30',
    'scope?kind=epic',
    'scope?kind=version',
    'stats?by=assignee&by2=priority',
    'time-tracking?days=30',
  ])('answers %s with UUID ids', (path) => {
    const body = get(api, `${W}/projects/PLT/reports/${path}`);
    expect(ids(body).every((id) => UUID.test(String(id)))).toBe(true);
  });

  it('counts the real issues in statistics, crossed cells adding up to the rows', () => {
    const stats = get(api, `${W}/projects/PLT/reports/stats?by=status&by2=priority`);
    const rows = stats['rows'] as { count: number }[];
    const cells = stats['cells'] as { count: number }[];
    const sum = (list: { count: number }[]) => list.reduce((total, item) => total + item.count, 0);
    expect(sum(rows)).toBe(stats['total']);
    expect(sum(cells)).toBe(stats['total']);
  });
});
