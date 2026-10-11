import { afterEach, describe, expect, it } from 'vitest';
import { card, testView } from './board-fixtures.ts';
import {
  cardMatches,
  hasClientFilters,
  quickFiltersOf,
  serverQuery,
  useBoardLanes,
  type BoardFilters,
} from './board-filters.ts';
import { checkLql, completeLql, insertSuggestion } from './board-lql.ts';

const none: BoardFilters = {
  q: '',
  lql: '',
  quick: [],
  assignee: [],
  epic: [],
  type: [],
  label: [],
};

afterEach(() => useBoardLanes.getState().reset());

describe('board filters', () => {
  const quick = quickFiltersOf(testView().board.config);

  it('lists the mock chips before the board’s own quick filters', () => {
    expect(quick.map((chip) => chip.name)).toEqual([
      'Only my issues',
      'Recently updated',
      'Blocked',
      'Bugs',
    ]);
  });

  it('sends only the LQL parts to the server, joined with AND', () => {
    expect(serverQuery(none, quick)).toBe('');
    expect(serverQuery({ ...none, quick: ['mine', 'board-0'] }, quick)).toBe('type = Bug');
    expect(serverQuery({ ...none, lql: 'priority = High', quick: ['recent'] }, quick)).toBe(
      '(priority = High) AND (updated >= -1d)',
    );
  });

  it('answers search, people, mine and blocked on the client', () => {
    const me = '018f0000-0000-7000-8000-0000000000aa';
    const mine = card(1, { assigneeId: me, title: 'Rotate tokens' });
    const blocked = card(2, { blockedBy: ['PLT-1'] });
    expect(hasClientFilters(none)).toBe(false);
    expect(cardMatches(mine, { ...none, q: 'rotate' }, me)).toBe(true);
    expect(cardMatches(blocked, { ...none, q: 'rotate' }, me)).toBe(false);
    expect(cardMatches(mine, { ...none, quick: ['mine'] }, me)).toBe(true);
    expect(cardMatches(blocked, { ...none, quick: ['mine'] }, me)).toBe(false);
    expect(cardMatches(blocked, { ...none, quick: ['blocked'] }, me)).toBe(true);
    expect(cardMatches(mine, { ...none, assignee: [me] }, me)).toBe(true);
    expect(cardMatches(blocked, { ...none, assignee: ['none'] }, me)).toBe(true);
  });

  it('folds and unfolds lanes and resets them', () => {
    useBoardLanes.getState().toggle('lane-1');
    expect(useBoardLanes.getState().collapsed).toEqual(['lane-1']);
    useBoardLanes.getState().toggle('lane-1');
    expect(useBoardLanes.getState().collapsed).toEqual([]);
  });
});

describe('LQL filter bar', () => {
  it('accepts an empty or valid query and positions the first problem', () => {
    expect(checkLql('')).toBeNull();
    expect(checkLql('priority = High AND assignee = me')).toBeNull();
    expect(checkLql('priorty = High')).toMatchObject({ position: 0 });
    expect(checkLql('priority = ')).not.toBeNull();
  });

  it('completes fields, then operators, then values from the board’s providers', () => {
    expect(completeLql('stat', 4, {}).items.map((item) => item.label)).toContain('status');
    expect(completeLql('status ', 7, {}).items.map((item) => item.label)).toContain('=');
    const values = completeLql('status = "In', 12, { statuses: ['In progress', 'Done'] });
    expect(values.items.map((item) => item.label)).toEqual(['In progress']);
    expect(values.items[0]?.text).toBe('"In progress"');
  });

  it('puts a suggestion in place of the word under the cursor', () => {
    const list = completeLql('stat', 4, {});
    const status = list.items.find((item) => item.label === 'status');
    if (!status) throw new Error('expected status');
    expect(insertSuggestion('stat', list, status)).toEqual({ text: 'status ', cursor: 7 });
  });
});
