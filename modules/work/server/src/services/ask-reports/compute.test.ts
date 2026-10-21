import { describe, expect, it } from 'vitest';
import type { ReportSpec } from '../../../../shared/ask-reports.ts';
import { reportSpecSchema } from '../../../../shared/ask-reports.ts';
import type { StatValue } from '../reports/stats.ts';
import { computeReport, measure, type ReportIssue } from './compute.ts';

const DAY = 86_400_000;
const T0 = Date.parse('2026-10-01T00:00:00Z');

const issue = (id: string, change: Partial<ReportIssue> = {}): ReportIssue => ({
  id,
  estimate: null,
  createdAt: T0,
  resolvedAt: null,
  done: false,
  ...change,
});

const spec = (change: Partial<ReportSpec> = {}): ReportSpec => ({
  title: 'Report',
  metric: 'issues',
  groupBy: 'none',
  filters: {},
  chart: 'number',
  ...change,
});

const now = new Date('2026-10-21T00:00:00Z');

describe('measure', () => {
  const issues = [
    issue('a', { estimate: 3, done: true, resolvedAt: T0 + 2 * DAY }),
    issue('b', { estimate: 5, done: true, resolvedAt: T0 + 4 * DAY }),
    issue('c', { estimate: 2 }),
    issue('d'),
  ];

  it('counts, sums points and counts what is still open', () => {
    expect(measure('issues', issues)).toEqual({ value: 4, issues: 4 });
    expect(measure('points', issues)).toEqual({ value: 10, issues: 4 });
    expect(measure('open_issues', issues)).toEqual({ value: 2, issues: 2 });
    expect(measure('open_points', issues)).toEqual({ value: 2, issues: 2 });
  });

  it('averages days to resolve over resolved issues only', () => {
    expect(measure('avg_resolution_days', issues)).toEqual({ value: 3, issues: 2 });
    expect(measure('avg_resolution_days', [issue('x')])).toEqual({ value: 0, issues: 0 });
  });

  it('gives progress as the percent of issues done', () => {
    expect(measure('progress', issues)).toEqual({ value: 50, issues: 4 });
    expect(measure('progress', [])).toEqual({ value: 0, issues: 0 });
  });
});

describe('computeReport', () => {
  it('draws one number with no grouping', () => {
    const result = computeReport({ spec: spec(), issues: [issue('a')], values: new Map(), now });
    expect(result).toMatchObject({ unit: 'issues', rows: [], total: 1, issues: 1 });
    expect(result.generatedAt).toBe(now.toISOString());
  });

  it('groups by a field, puts the none bucket last and drops empty groups', () => {
    const ana: StatValue = { id: 'ana', label: 'Ana', order: null };
    const bo: StatValue = { id: 'bo', label: 'Bo', order: null };
    const values = new Map([
      ['a', [ana]],
      ['b', [ana, bo]],
      ['c', [bo]],
    ]);
    const issues = [issue('a'), issue('b'), issue('c', { done: true }), issue('d')];
    const result = computeReport({
      spec: spec({ metric: 'open_issues', groupBy: 'assignee', chart: 'bar' }),
      issues,
      values,
      now,
    });
    expect(result.rows).toEqual([
      { id: 'ana', label: 'Ana', value: 2, issues: 2 },
      { id: 'bo', label: 'Bo', value: 1, issues: 1 },
      { id: null, label: 'Unassigned', value: 1, issues: 1 },
    ]);
    expect(result.total).toBe(3);
  });

  it('keeps a field’s natural order ahead of size', () => {
    const values = new Map([
      ['a', [{ id: 'todo', label: 'To do', order: 0 }]],
      ['b', [{ id: 'done', label: 'Done', order: 2 }]],
      ['c', [{ id: 'done', label: 'Done', order: 2 }]],
    ]);
    const result = computeReport({
      spec: spec({ groupBy: 'status', chart: 'bar' }),
      issues: [issue('a'), issue('b'), issue('c')],
      values,
      now,
    });
    expect(result.rows.map((row) => row.label)).toEqual(['To do', 'Done']);
  });
});

describe('the report spec', () => {
  it('accepts only the closed vocabulary', () => {
    expect(reportSpecSchema.safeParse(spec()).success).toBe(true);
    expect(reportSpecSchema.safeParse({ ...spec(), metric: 'select * from users' }).success).toBe(
      false,
    );
    expect(
      reportSpecSchema.safeParse({ ...spec(), filters: { createdWithinDays: 0 } }).success,
    ).toBe(false);
  });
});
