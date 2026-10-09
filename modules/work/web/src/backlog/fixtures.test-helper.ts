import type { Backlog, Issue, Sprint } from '@bemmoly/module-work/shared';

/** Small backlogs for the move, selection and hook tests; ids are readable on purpose. */

export const PROJECT = '018f0000-0000-7000-8000-000000000900';
const STAMP = '2026-10-01T09:00:00.000Z';

export const id = (n: number) => `018f0000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;

export const STATUS = { todo: id(0x920), doing: id(0x922), done: id(0x926) } as const;

export function issue(number: number, rank: string, fields: Partial<Issue> = {}): Issue {
  return {
    id: id(0xb00 + number),
    projectId: PROJECT,
    number,
    key: `PLT-${number}`,
    typeId: id(0x961),
    title: `Issue ${number}`,
    description: null,
    descriptionText: '',
    statusId: STATUS.todo,
    priority: 'medium',
    assigneeId: null,
    reporterId: null,
    parentId: null,
    sprintId: null,
    estimate: 1,
    dueAt: null,
    fixVersionId: null,
    componentId: null,
    customFields: {},
    labelIds: [],
    rank,
    statusChangedAt: STAMP,
    resolvedAt: null,
    deletedAt: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...fields,
  };
}

export function sprint(n: number, fields: Partial<Sprint> = {}): Sprint {
  return {
    id: id(0xa00 + n),
    projectId: PROJECT,
    name: `PLT Sprint ${n}`,
    goal: null,
    startsAt: null,
    endsAt: null,
    state: 'future',
    capacityPoints: null,
    completedSnapshot: null,
    startedAt: null,
    closedAt: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...fields,
  };
}

/** Sprint 14 (active) holds 1, 2, 3; Sprint 15 holds 4; the backlog holds 5, 6, 7. */
export function sampleBacklog(): Backlog {
  const s14 = sprint(14, { state: 'active' });
  const s15 = sprint(15, { capacityPoints: 8 });
  const inSprint = (sprintId: string) => ({ sprintId });
  const a = [issue(1, 'b', inSprint(s14.id)), issue(2, 'c', inSprint(s14.id))];
  const held14 = [...a, issue(3, 'd', inSprint(s14.id))];
  const held15 = [issue(4, 'e', inSprint(s15.id))];
  return {
    projectId: PROJECT,
    sprints: [
      { sprint: s14, issues: held14, committedPoints: 3, committedIssues: 3 },
      { sprint: s15, issues: held15, committedPoints: 1, committedIssues: 1 },
    ],
    issues: [issue(5, 'f'), issue(6, 'g'), issue(7, 'h')],
    epics: [],
  };
}

export const keysOf = (issues: readonly Issue[]) => issues.map((row) => row.key);
