import { describe, expect, it } from 'vitest';
import { completions, flowMetrics, type FlowInput, type StatusChange } from './flow.ts';

const at = (iso: string) => Date.parse(iso);
const DOING = 'doing';
const DONE = 'done';

const change = (issueId: string, to: string, iso: string): StatusChange => ({
  issueId,
  to,
  at: at(iso),
});

const issue = (id: string, created: string, statusId = DONE, resolved: string | null = null) => ({
  id,
  createdAt: at(created),
  resolvedAt: resolved ? at(resolved) : null,
  statusId,
});

const INPUT: FlowInput = {
  issues: [
    issue('X', '2026-03-15T12:00:00Z'),
    issue('Y', '2026-03-24T12:00:00Z'),
    issue('Z', '2026-03-01T12:00:00Z', DONE, '2026-03-10T12:00:00Z'),
    issue('W', '2026-03-01T12:00:00Z', DOING),
    issue('V', '2026-02-10T12:00:00Z'),
    issue('U', '2026-03-01T12:00:00Z'),
  ],
  changes: [
    change('X', DOING, '2026-03-20T12:00:00Z'),
    change('X', DONE, '2026-03-25T12:00:00Z'),
    change('Y', DONE, '2026-03-26T12:00:00Z'),
    change('W', DONE, '2026-03-20T12:00:00Z'),
    change('W', DOING, '2026-03-21T12:00:00Z'),
    change('V', DONE, '2026-02-20T12:00:00Z'),
    change('U', DOING, '2026-03-02T12:00:00Z'),
    change('U', DONE, '2026-03-05T12:00:00Z'),
    change('U', DOING, '2026-03-06T12:00:00Z'),
    change('U', DONE, '2026-03-08T12:00:00Z'),
  ],
  done: new Set([DONE]),
  inProgress: new Set([DOING]),
  now: at('2026-03-29T12:00:00Z'),
};

describe('completions', () => {
  it('takes the last move into done and the first move into progress before it', () => {
    const byIssue = Object.fromEntries(completions(INPUT).map((c) => [c.issueId, c]));
    expect(Object.keys(byIssue).sort()).toEqual(['U', 'V', 'X', 'Y', 'Z']);
    expect(byIssue['U']).toEqual({
      issueId: 'U',
      startedAt: at('2026-03-02T12:00:00Z'),
      completedAt: at('2026-03-08T12:00:00Z'),
    });
    expect(byIssue['Y']?.startedAt).toBe(at('2026-03-24T12:00:00Z'));
    expect(byIssue['Z']?.completedAt).toBe(at('2026-03-10T12:00:00Z'));
  });
});

describe('flowMetrics', () => {
  it('buckets completions by week and averages cycle time over the last thirty days', () => {
    expect(flowMetrics(INPUT)).toEqual({
      throughputHistory: [0, 0, 1, 0, 1, 1, 0, 2],
      throughputPerWeek: 1,
      cycleTimeDays: 5.5,
    });
  });

  it('has no cycle time without recent completions', () => {
    expect(flowMetrics({ ...INPUT, issues: [], changes: [] })).toEqual({
      throughputHistory: [0, 0, 0, 0, 0, 0, 0, 0],
      throughputPerWeek: 0,
      cycleTimeDays: null,
    });
  });
});
