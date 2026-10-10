import { describe, expect, it } from 'vitest';
import { boardConfigSchema, type BoardCard, type BoardConfig } from '../../../../shared/boards.ts';
import { groupBoard, type GroupCard, type LaneNames } from './group.ts';

const id = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const TODO = id(1);
const DOING = id(2);
const DONE = id(3);
const ORPHAN = id(4);
const ANA = id(10);
const BEN = id(11);
const EPIC = id(20);

const board = (lanes: Partial<BoardConfig['lanes']> = {}): BoardConfig =>
  boardConfigSchema.parse({
    columns: [
      { id: 'todo', name: 'To do', statusIds: [TODO] },
      { id: 'doing', name: 'Doing', statusIds: [DOING], wipLimit: 1 },
      { id: 'done', name: 'Done', statusIds: [DONE], done: true },
    ],
    lanes,
  });

const card = (key: string, statusId: string, extra: Partial<BoardCard> = {}): BoardCard => ({
  issueId: id(100 + Number(key.split('-')[1])),
  key,
  title: key,
  typeId: id(30),
  statusId,
  priority: 'medium',
  assigneeId: null,
  estimate: null,
  labelIds: [],
  rank: 'n',
  blockedBy: [],
  dueAt: null,
  subtasks: null,
  parentId: null,
  docs: [],
  ageDays: 0,
  ...extra,
});

const entry = (c: BoardCard, epicId: string | null = null, queryLane: number | null = null) =>
  ({ card: c, epicId, queryLane }) satisfies GroupCard;

const NAMES: LaneNames = {
  epics: new Map([[EPIC, { key: 'PLT-1', title: 'Checkout', dueAt: '2026-11-01', color: 'epic-3' }]]),
  users: new Map([
    [BEN, 'Ben'],
    [ANA, 'Ana'],
  ]),
  types: new Map([[id(30), 'Story']]),
};

const CARDS = [
  entry(card('PLT-2', DOING, { assigneeId: BEN, priority: 'high' }), EPIC, 0),
  entry(card('PLT-3', TODO, { assigneeId: ANA })),
  entry(card('PLT-4', DOING, { assigneeId: ANA }), EPIC),
  entry(card('PLT-5', ORPHAN)),
  entry(card('PLT-6', DONE), null, 0),
];

describe('groupBoard', () => {
  it('places cards in their columns in the order given and flags a column over its limit', () => {
    const view = groupBoard(board(), CARDS, NAMES);
    expect(view.cards.map((c) => [c.key, c.columnId, c.laneId])).toEqual([
      ['PLT-2', 'doing', 'all'],
      ['PLT-3', 'todo', 'all'],
      ['PLT-4', 'doing', 'all'],
      ['PLT-6', 'done', 'all'],
    ]);
    expect(view.columns).toEqual([
      { id: 'todo', count: 1, wipLimit: null, overWip: false },
      { id: 'doing', count: 2, wipLimit: 1, overWip: true },
      { id: 'done', count: 1, wipLimit: null, overWip: false },
    ]);
    expect(view.lanes.map((lane) => lane.id)).toEqual(['all']);
  });

  it('makes epic lanes with the key, due date and stored colour, and a lane for work in no epic', () => {
    const view = groupBoard(board({ kind: 'epic' }), CARDS, NAMES);
    expect(view.lanes).toEqual([
      {
        id: EPIC,
        label: 'Checkout',
        color: 'epic-3',
        issueKey: 'PLT-1',
        dueAt: '2026-11-01',
      },
      { id: 'none', label: 'No epic', color: null, issueKey: null, dueAt: null },
    ]);
    expect(view.cards.filter((c) => c.laneId === EPIC).map((c) => c.key)).toEqual([
      'PLT-2',
      'PLT-4',
    ]);
  });

  it('orders assignee lanes by name and keeps only the ones in use', () => {
    const view = groupBoard(board({ kind: 'assignee' }), CARDS, NAMES);
    expect(view.lanes.map((lane) => lane.label)).toEqual(['Ana', 'Ben', 'Unassigned']);
  });

  it('shows every priority lane when empty lanes are kept', () => {
    const view = groupBoard(board({ kind: 'priority', showEmpty: true }), CARDS, NAMES);
    expect(view.lanes.map((lane) => lane.id)).toEqual([
      'highest',
      'high',
      'medium',
      'low',
      'lowest',
    ]);
    expect(view.lanes[1]?.label).toBe('High');
  });

  it('puts each card in the first lane query it matches and the rest in "Everything else"', () => {
    const config = board({
      kind: 'query',
      queries: [
        { name: 'Urgent', query: 'priority = high' },
        { name: 'Later', query: 'priority = low' },
      ],
    });
    const view = groupBoard(config, CARDS, NAMES);
    expect(view.lanes.map((lane) => [lane.id, lane.label])).toEqual([
      ['query-0', 'Urgent'],
      ['query-1', 'Later'],
      ['none', 'Everything else'],
    ]);
    expect(view.cards.map((c) => c.laneId)).toEqual(['query-0', 'none', 'none', 'query-0']);
  });
});
