import { describe, expect, it } from 'vitest';
import { flowReportDays, reportCutoffs } from './cfd.ts';

const at = (iso: string) => Date.parse(iso);
const NOW = at('2026-03-12T18:00:00Z');

const base = {
  done: new Set(['done']),
  inProgress: new Set(['doing']),
  now: NOW,
  days: 7,
};

describe('reportCutoffs', () => {
  it('ends each of the last days at midnight, the last one now', () => {
    const cutoffs = reportCutoffs(NOW, 3);
    expect(cutoffs.map((cutoff) => new Date(cutoff).toISOString())).toEqual([
      '2026-03-10T23:59:59.999Z',
      '2026-03-11T23:59:59.999Z',
      '2026-03-12T18:00:00.000Z',
    ]);
  });
});

/*
 * A was created before the window and moved todo → doing on the 10th and
 * doing → done on the 11th; B was created on the 11th; C was created on the
 * 9th and deleted on the 12th.
 */
describe('flowReportDays', () => {
  const report = flowReportDays({
    ...base,
    issues: [
      { id: 'A', statusId: 'done', createdAt: at('2026-03-01T00:00:00Z'), deletedAt: null },
      { id: 'B', statusId: 'todo', createdAt: at('2026-03-11T09:00:00Z'), deletedAt: null },
      {
        id: 'C',
        statusId: 'todo',
        createdAt: at('2026-03-09T09:00:00Z'),
        deletedAt: at('2026-03-12T09:00:00Z'),
      },
    ],
    changes: [
      { issueId: 'A', from: 'todo', to: 'doing', at: at('2026-03-10T10:00:00Z') },
      { issueId: 'A', from: 'doing', to: 'done', at: at('2026-03-11T10:00:00Z') },
    ],
  });
  const byDate = new Map(report.map((day) => [day.date, day]));

  it('covers the window, oldest first', () => {
    expect(report).toHaveLength(7);
    expect(report[0]?.date).toBe('2026-03-06');
    expect(report.at(-1)?.date).toBe('2026-03-12');
  });

  it('rewinds each issue to its status at the end of the day', () => {
    expect(byDate.get('2026-03-08')).toMatchObject({ todo: 1, inProgress: 0, done: 0 });
    expect(byDate.get('2026-03-09')).toMatchObject({ todo: 2, inProgress: 0, done: 0 });
    expect(byDate.get('2026-03-10')).toMatchObject({ todo: 1, inProgress: 1, done: 0 });
    expect(byDate.get('2026-03-11')).toMatchObject({ todo: 2, inProgress: 0, done: 1 });
    expect(byDate.get('2026-03-12')).toMatchObject({ todo: 1, inProgress: 0, done: 1 });
  });

  it('counts creations and resolutions on their day', () => {
    expect(byDate.get('2026-03-09')).toMatchObject({ created: 1, resolved: 0 });
    expect(byDate.get('2026-03-11')).toMatchObject({ created: 1, resolved: 1 });
    expect(report.reduce((sum, day) => sum + day.created, 0)).toBe(2);
  });
});
