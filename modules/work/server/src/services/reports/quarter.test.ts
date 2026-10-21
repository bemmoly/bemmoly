import { describe, expect, it } from 'vitest';
import {
  quarterCutoffs,
  quarterReport,
  type QuarterIssue,
  type QuarterSprintRow,
} from './quarter.ts';

const at = (date: string) => Date.parse(`${date}T12:00:00.000Z`);
const id = (n: number) => `018f0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const EPIC = id(900);

const issue = (n: number, over: Partial<QuarterIssue>): QuarterIssue => ({
  id: id(n),
  parentId: EPIC,
  points: 2,
  createdAt: at('2026-09-01'),
  resolvedAt: null,
  deletedAt: null,
  done: false,
  ...over,
});

const sprint = (n: number, over: Partial<QuarterSprintRow>): QuarterSprintRow => ({
  id: id(n),
  name: `Sprint ${n}`,
  state: 'closed',
  startsAt: null,
  endsAt: null,
  startedAt: null,
  closedAt: null,
  snapshot: null,
  points: 0,
  donePoints: 0,
  ...over,
});

describe('quarter report', () => {
  const now = at('2026-10-21');

  it('cuts weeks from the quarter start to now', () => {
    const start = Date.UTC(2026, 9, 1);
    const cutoffs = quarterCutoffs(start, Date.UTC(2027, 0, 1), now);
    expect(cutoffs).toHaveLength(3);
    expect(cutoffs.at(-1)).toBe(now);
    expect(quarterCutoffs(start, Date.UTC(2027, 0, 1), start - 1)).toEqual([]);
  });

  it('counts open work, new work and what was finished inside the quarter', () => {
    const report = quarterReport({
      quarter: '2026-Q4',
      now,
      issues: [
        issue(1, {}),
        issue(2, { done: true, resolvedAt: at('2026-09-20') }),
        issue(3, { done: true, resolvedAt: at('2026-10-03'), points: 3 }),
        issue(4, { createdAt: at('2026-10-10') }),
        issue(5, { deletedAt: at('2026-10-02') }),
      ],
      sprints: [],
      epics: [{ id: EPIC, key: 'PLT-1', title: 'Billing', done: false, createdAt: 0 }],
    });
    expect(report.from).toBe('2026-10-01');
    expect(report.to).toBe('2026-12-31');
    expect(report.elapsed).toBeCloseTo(0.22, 2);
    const last = report.weeks.at(-1);
    expect(last).toMatchObject({ scopeIssues: 3, completedIssues: 1, completedPoints: 3 });
    expect(report.weeks[0]).toMatchObject({ scopeIssues: 2, completedIssues: 1 });
    expect(report.epics).toEqual([
      expect.objectContaining({ key: 'PLT-1', issues: 4, doneIssues: 2, completedInQuarter: 1 }),
    ]);
  });

  it('keeps the sprints that overlap the quarter, closed ones from their snapshot', () => {
    const report = quarterReport({
      quarter: '2026-Q4',
      now,
      issues: [],
      epics: [],
      sprints: [
        sprint(1, {
          startedAt: at('2026-09-01'),
          closedAt: at('2026-09-14'),
          snapshot: { committedPoints: 10, completedPoints: 8 },
        }),
        sprint(2, {
          startedAt: at('2026-09-25'),
          closedAt: at('2026-10-08'),
          snapshot: { committedPoints: 12, completedPoints: 9 },
        }),
        sprint(3, { state: 'active', startedAt: at('2026-10-09'), points: 14, donePoints: 4 }),
        sprint(4, { state: 'future', startsAt: at('2026-10-23'), endsAt: at('2026-11-06') }),
        sprint(5, { state: 'future' }),
      ],
    });
    expect(
      report.sprints.map((row) => [row.name, row.committedPoints, row.completedPoints]),
    ).toEqual([
      ['Sprint 2', 12, 9],
      ['Sprint 3', 14, 4],
      ['Sprint 4', 0, 0],
    ]);
    expect(report.sprints[1]?.to).toBeNull();
  });

  it('draws nothing yet for a quarter that has not begun, and leaves out finished epics', () => {
    const report = quarterReport({
      quarter: '2027-Q1',
      now,
      issues: [issue(1, { done: true, resolvedAt: at('2026-10-01') })],
      sprints: [],
      epics: [{ id: EPIC, key: 'PLT-1', title: 'Done', done: true, createdAt: 0 }],
    });
    expect(report.weeks).toEqual([]);
    expect(report.elapsed).toBe(0);
    expect(report.epics).toEqual([]);
  });
});
