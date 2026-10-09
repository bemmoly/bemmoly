import type { BoardView } from '@bemmoly/module-work/shared';

/*
 * A small board for the board hooks' tests: three columns over four statuses, an epic lane and
 * "No epic", five cards. Ids are valid UUIDs so the shared schemas accept them.
 */

const id = (n: number) => `018f0000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;

export const STATUS = { backlog: id(1), selected: id(2), doing: id(3), done: id(4) } as const;
export const EPIC = id(50);
export const BOARD_ID = id(60);

type Card = BoardView['cards'][number];

export function card(n: number, fields: Partial<Card> = {}): Card {
  return {
    issueId: id(100 + n),
    key: `PLT-${n}`,
    title: `Issue ${n}`,
    typeId: id(70),
    statusId: STATUS.selected,
    priority: 'medium',
    assigneeId: null,
    estimate: 1,
    labelIds: [],
    rank: 'm',
    blockedBy: [],
    dueAt: null,
    subtasks: null,
    parentId: EPIC,
    docs: [],
    ageDays: 1,
    columnId: 'todo',
    laneId: EPIC,
    ...fields,
  };
}

export function testView(cards: Card[] = defaultCards()): BoardView {
  const count = (columnId: string) => cards.filter((entry) => entry.columnId === columnId).length;
  return {
    board: {
      id: BOARD_ID,
      projectId: id(80),
      originId: null,
      name: 'PLT board',
      config: {
        columns: [
          {
            id: 'todo',
            name: 'To do',
            statusIds: [STATUS.backlog, STATUS.selected],
            wipLimit: null,
            done: false,
          },
          { id: 'doing', name: 'In progress', statusIds: [STATUS.doing], wipLimit: 2, done: false },
          { id: 'done', name: 'Done', statusIds: [STATUS.done], wipLimit: null, done: true },
        ],
        collapseEmptyColumns: true,
        showColumnCounts: true,
        showUnassigned: false,
        lanes: { kind: 'epic', queries: [], showEmpty: false, collapsible: true, totals: true },
        cardFields: ['type', 'key', 'priority', 'labels', 'estimate', 'assignee'],
        colorRule: 'none',
        estimationUnit: 'points',
        cadenceDays: 14,
        workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        quickFilters: [{ name: 'Bugs', query: 'type = Bug' }],
        colors: {},
      },
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    sprintId: null,
    columns: [
      { id: 'todo', count: count('todo'), wipLimit: null, overWip: false },
      { id: 'doing', count: count('doing'), wipLimit: 2, overWip: count('doing') > 2 },
      { id: 'done', count: count('done'), wipLimit: null, overWip: false },
    ],
    lanes: [
      { id: EPIC, label: 'Auth service', color: null, issueKey: 'PLT-1', dueAt: '2026-10-11' },
      { id: 'none', label: 'No epic', color: null, issueKey: null, dueAt: null },
    ],
    cards,
    metrics: {
      throughputPerWeek: 4,
      cycleTimeDays: 3,
      wipCount: 2,
      committedPoints: 10,
      completedPoints: 3,
      throughputHistory: [1, 2, 3, 4, 5, 6, 7, 8],
    },
  };
}

/** To do: 10 (b), 11 (d); In progress: 12 (c), 13 (e); Done: 14; No epic: 15 in To do. */
export function defaultCards(): Card[] {
  return [
    card(10, { rank: 'b' }),
    card(11, { rank: 'd' }),
    card(12, { rank: 'c', columnId: 'doing', statusId: STATUS.doing, estimate: 3 }),
    card(13, { rank: 'e', columnId: 'doing', statusId: STATUS.doing, estimate: 2 }),
    card(14, { rank: 'f', columnId: 'done', statusId: STATUS.done, estimate: 5 }),
    card(15, { rank: 'g', parentId: null, laneId: 'none', assigneeId: id(90) }),
  ];
}
