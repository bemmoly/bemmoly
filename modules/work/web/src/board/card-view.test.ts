import { CARD_FIELDS, type CardField } from '@bemmoly/module-work/shared';
import { describe, expect, it } from 'vitest';
import { card, EPIC } from '../hooks/board-fixtures.ts';
import { cardDay, cardProps, footerOrder, type CardVocabulary } from './card-view.ts';

const TYPE = '018f0000-0000-7000-8000-000000000046';
const ME = '018f0000-0000-7000-8000-0000000000aa';
const PRIYA = '018f0000-0000-7000-8000-0000000000ab';
const LABEL = '018f0000-0000-7000-8000-0000000000bb';
const OTHER_EPIC = '018f0000-0000-7000-8000-0000000000cc';

type Props = ReturnType<typeof cardProps>;

function vocab(fields: readonly CardField[], extra: Partial<CardVocabulary> = {}): CardVocabulary {
  return {
    types: new Map([[TYPE, { key: 'bug', name: 'Bug', level: 'standard' }]]),
    people: new Map([
      [ME, { id: ME, name: 'Rohan S.' }],
      [PRIYA, { id: PRIYA, name: 'Priya N.' }],
    ]),
    labels: new Map([[LABEL, { name: 'customer' }]]),
    meId: ME,
    shown: new Set(fields),
    order: footerOrder(fields),
    colorRule: 'none',
    doneColumns: new Set(['done']),
    today: '2026-10-11',
    epicColors: new Map([
      [EPIC, 'epic-3'],
      [OTHER_EPIC, 'epic-6'],
    ]),
    ruleColor: () => null,
    ...extra,
  };
}

/** A card with a value for every field. */
const full = card(1, {
  typeId: TYPE,
  priority: 'high',
  assigneeId: ME,
  estimate: 5,
  labelIds: [LABEL],
  blockedBy: ['PLT-9'],
  dueAt: '2026-10-06',
  subtasks: { done: 1, total: 3 },
  docs: ['RFC'],
  ageDays: 6,
  reporterId: PRIYA,
  createdAt: '2026-09-28',
});

/** The props a field adds to a card, beyond what every card carries. */
const OPTIONAL = [
  'priority',
  'assignee',
  'labels',
  'estimate',
  'age',
  'blockedBy',
  'doc',
  'subtasks',
  'due',
  'created',
  'reporter',
] as const;

const optionalOf = (props: object) =>
  OPTIONAL.filter((key) => (props as Record<string, unknown>)[key] !== undefined);

describe('cardProps', () => {
  it('draws exactly the fields the board lists, every one of them wired', () => {
    const drawn: Record<CardField, (props: Props) => unknown> = {
      type: (p) => p.showType,
      key: (p) => p.showKey,
      priority: (p) => p.priority,
      labels: (p) => p.labels,
      estimate: (p) => p.estimate,
      assignee: (p) => p.assignee,
      docs: (p) => p.doc,
      blocked: (p) => p.blockedBy,
      due: (p) => p.due,
      subtasks: (p) => p.subtasks,
      reporter: (p) => p.reporter,
      created: (p) => p.created,
      age: (p) => p.age,
    };
    for (const field of CARD_FIELDS) {
      const read = drawn[field];
      const on = read(cardProps(full, vocab([field]), null));
      const off = read(cardProps(full, vocab(CARD_FIELDS.filter((f) => f !== field)), null));
      expect(on, `${field} on`).toBeTruthy();
      expect(off, `${field} off`).toBeFalsy();
    }
  });

  it('nothing beyond the board’s fields: no time in column, points or type unless listed', () => {
    const props = cardProps(full, vocab(['key']), null);
    expect(optionalOf(props)).toEqual([]);
    expect(props.showType).toBe(false);
    expect(props.showKey).toBe(true);
  });

  it('shows estimate and time in column on any board when listed, a tick once done', () => {
    const fields: CardField[] = ['estimate', 'age'];
    expect(cardProps(full, vocab(fields), null)).toMatchObject({
      estimate: 5,
      age: { label: '6d', slow: true },
    });
    const done = cardProps({ ...full, columnId: 'done' }, vocab(fields), null);
    expect(done.age).toEqual({ label: 'Done', done: true });
  });

  it('prints dates, marks a past due date overdue until the card is done', () => {
    const props = cardProps(full, vocab(['due', 'created', 'reporter']), null);
    expect(props.due).toEqual({ label: 'Oct 6', overdue: true });
    expect(props.created).toBe('Sep 28');
    expect(props.reporter?.name).toBe('Priya N.');
    const done = cardProps({ ...full, columnId: 'done' }, vocab(['due']), null);
    expect(done.due?.overdue).toBe(false);
    expect(cardDay('2025-12-31', '2026-10-11')).toBe('Dec 31, 2025');
  });

  it('leaves out a listed field the issue has no value for; an unassigned card keeps the ring', () => {
    const bare = card(2, { estimate: null, parentId: null, createdAt: null });
    const props = cardProps(bare, vocab([...CARD_FIELDS].filter((f) => f !== 'age')), null);
    expect(optionalOf(props)).toEqual(['priority', 'assignee']);
    expect(props.assignee).toBeNull();
  });

  it('keeps the board’s order for the footer', () => {
    expect(footerOrder(['labels', 'due', 'key', 'blocked', 'assignee', 'estimate'])).toEqual([
      'due',
      'key',
      'assignee',
      'estimate',
    ]);
  });

  it('paints the stripe of the colour preset, the epic from the card on any lanes, rules first', () => {
    expect(cardProps(full, vocab([], { colorRule: 'priority' }), null).stripeClassName).toBe(
      'border-l-amber',
    );
    const epic = vocab([], { colorRule: 'epic' });
    expect(cardProps(full, epic, null).stripeClassName).toBe('border-l-epic-3');
    expect(cardProps({ ...full, epicId: OTHER_EPIC }, epic, null).stripeClassName).toBe(
      'border-l-epic-6',
    );
    const ruled = vocab([], { colorRule: 'priority', ruleColor: () => '#c42d2d' });
    expect(cardProps(full, ruled, null).stripeClassName).toBe('border-l-(--card-rule)');
    expect(cardProps(full, vocab([]), null).stripeClassName).toBeUndefined();
  });
});
