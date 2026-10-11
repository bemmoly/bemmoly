import { describe, expect, it } from 'vitest';
import { rowsOf, table } from './report.ts';

describe('results table', () => {
  const metrics = {
    'http_req_duration{endpoint:board_view,phase:measure}': {
      med: 21.3,
      'p(95)': 91.2,
      'p(99)': 120.9,
      count: 1200,
      thresholds: { 'p(95)<80': true },
    },
    'http_req_duration{endpoint:issue_create}': {
      med: 40,
      'p(95)': 70,
      'p(99)': 90,
      count: 10,
      thresholds: { 'max>=0': false },
    },
    collab_delivered: { passes: 999, fails: 1, value: 0.999, thresholds: { 'rate>0.999': false } },
    collab_errors: { count: 0, thresholds: { 'count<1': false } },
    http_reqs: { count: 1210 },
  };

  it('turns thresholded metrics into rows, crossed ones failing', () => {
    const rows = rowsOf('board', metrics);
    expect(rows.map((r) => [r.metric, r.result])).toEqual([
      ['http_req_duration{endpoint:board_view,phase:measure}', 'fail'],
      ['http_req_duration{endpoint:issue_create}', 'report'],
      ['collab_delivered', 'pass'],
      ['collab_errors', 'pass'],
    ]);
    expect(rows[0]).toMatchObject({ p50: 21.3, p95: 91.2, p99: 120.9, value: 'n=1200' });
    expect(rows[2]?.value).toBe('99.90% of 1000');
  });

  it('renders markdown', () => {
    const markdown = table(rowsOf('board', metrics));
    expect(markdown.split('\n')).toHaveLength(6);
    expect(markdown).toContain('| board | `collab_errors` | count<1 |  |  |  | 0 | pass |');
  });
});
