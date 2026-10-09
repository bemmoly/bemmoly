import type { WorkflowStatus } from '@bemmoly/module-work/shared';
import { describe, expect, it } from 'vitest';
import { id, issue, sampleBacklog, sprint, STATUS } from './fixtures.test-helper.ts';
import {
  BACKLOG_ID,
  containersOf,
  countsOf,
  epicMeta,
  epicPercent,
  matches,
  nextSprintName,
  NO_FILTERS,
  sprintDates,
  statusLooks,
} from './model.ts';

const status = (
  statusId: string,
  name: string,
  category: WorkflowStatus['category'],
): WorkflowStatus => ({
  id: statusId,
  workflowId: id(0x904),
  name,
  category,
  color: null,
  position: 0,
  allowedRoleIds: [],
});

const STATUSES = [
  status(id(0x921), 'Selected', 'todo'),
  status(STATUS.doing, 'In progress', 'in_progress'),
  status(id(0x923), 'Code review', 'in_progress'),
  status(id(0x925), 'Testing', 'in_progress'),
  status(STATUS.done, 'Done', 'done'),
  status(id(0x927), "Won't do", 'done'),
];

const COLUMNS = [
  { id: 'todo', name: 'To do', statusIds: [id(0x921)], wipLimit: null, done: false },
  { id: 'p', name: 'In progress', statusIds: [STATUS.doing], wipLimit: null, done: false },
  { id: 'r', name: 'In review', statusIds: [id(0x923)], wipLimit: null, done: false },
  { id: 'q', name: 'QA', statusIds: [id(0x925)], wipLimit: null, done: false },
  { id: 'd', name: 'Done', statusIds: [STATUS.done], wipLimit: null, done: true },
];

describe('statusLooks', () => {
  it('names a status after its board column and colours it by the column order', () => {
    const looks = statusLooks(STATUSES, { columns: COLUMNS });
    expect(looks.get(id(0x921))).toEqual({ label: 'To do', category: 'todo', done: false });
    expect(looks.get(STATUS.doing)?.category).toBe('progress');
    expect(looks.get(id(0x923))).toMatchObject({ label: 'In review', category: 'review' });
    expect(looks.get(id(0x925))).toMatchObject({ label: 'QA', category: 'qa' });
    expect(looks.get(STATUS.done)).toMatchObject({ category: 'done', done: true });
  });

  it('keeps the status name when no column holds it, or there is no board', () => {
    expect(statusLooks(STATUSES, { columns: COLUMNS }).get(id(0x927))).toEqual({
      label: "Won't do",
      category: 'done',
      done: true,
    });
    expect(statusLooks(STATUSES, null).get(STATUS.doing)).toMatchObject({
      label: 'In progress',
      category: 'progress',
    });
  });
});

describe('filters and counts', () => {
  const row = issue(9, 'm', {
    title: 'Rotate service tokens',
    parentId: id(1),
    assigneeId: id(2),
  });

  it('matches on title or key, epic, type and assignee', () => {
    expect(matches(row, { ...NO_FILTERS, text: 'TOKENS' })).toBe(true);
    expect(matches(row, { ...NO_FILTERS, text: 'plt-9' })).toBe(true);
    expect(matches(row, { ...NO_FILTERS, text: 'billing' })).toBe(false);
    expect(matches(row, { ...NO_FILTERS, epicId: id(1) })).toBe(true);
    expect(matches(row, { ...NO_FILTERS, epicId: id(3) })).toBe(false);
    expect(matches(row, { ...NO_FILTERS, typeIds: [id(0x962)] })).toBe(false);
    expect(matches(row, { ...NO_FILTERS, assigneeIds: ['none'] })).toBe(false);
    expect(matches(issue(10, 'n'), { ...NO_FILTERS, assigneeIds: ['none'] })).toBe(true);
  });

  it('counts to do, in progress and done by the board look', () => {
    const looks = statusLooks(STATUSES, { columns: COLUMNS });
    const rows = [
      issue(1, 'b', { statusId: id(0x921) }),
      issue(2, 'c', { statusId: STATUS.doing }),
      issue(3, 'd', { statusId: id(0x925) }),
      issue(4, 'e', { statusId: STATUS.done }),
    ];
    expect(countsOf(rows, looks)).toEqual({ todo: 1, doing: 2, done: 1 });
  });
});

describe('containers, sprints and epics', () => {
  it('lists the sprints then the backlog', () => {
    expect(containersOf(sampleBacklog()).map((c) => c.id)).toEqual([
      id(0xa0e),
      id(0xa0f),
      BACKLOG_ID,
    ]);
  });

  it('prints sprint dates the way the mock does', () => {
    const dated = sprint(14, {
      startsAt: '2026-09-23T09:00:00.000Z',
      endsAt: '2026-10-07T17:00:00.000Z',
    });
    expect(sprintDates(dated)).toBe('Sep 23 – Oct 7');
    expect(sprintDates(sprint(16))).toBeUndefined();
  });

  it('names the next sprint one past the highest number', () => {
    expect(nextSprintName('PLT', [{ name: 'PLT Sprint 14' }, { name: 'PLT Sprint 15' }])).toBe(
      'PLT Sprint 16',
    );
    expect(nextSprintName('PLT', [])).toBe('PLT Sprint 1');
  });

  it('measures epic progress in points, falling back to issue counts', () => {
    const epic = {
      id: id(1),
      key: 'PLT-180',
      title: 'Auth service',
      statusId: STATUS.doing,
      color: null,
      done: 3,
      total: 9,
      donePoints: 31,
      totalPoints: 51,
    };
    expect(Math.round(epicPercent(epic))).toBe(61);
    expect(epicPercent({ ...epic, totalPoints: 0 })).toBeCloseTo(33.33, 1);
    expect(epicMeta(epic)).toBe('9 issues · 3 done');
    expect(epicMeta({ ...epic, done: 0 })).toBe('9 issues · not started');
  });
});
