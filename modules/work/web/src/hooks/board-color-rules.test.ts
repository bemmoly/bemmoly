import { describe, expect, it } from 'vitest';
import { compileColorRules, type RuleNames } from './board-color-rules.ts';
import { card, EPIC, STATUS } from './board-fixtures.ts';

const ME = '018f0000-0000-7000-8000-0000000000aa';
const LABEL = '018f0000-0000-7000-8000-0000000000bb';

const names: RuleNames = {
  meId: ME,
  statusName: (id) => (id === STATUS.doing ? 'In progress' : 'Selected'),
  statusCategory: (id) => (id === STATUS.doing ? 'in_progress' : 'todo'),
  typeName: () => 'Bug',
  userName: (id) => (id === ME ? 'Rohan S.' : undefined),
  labelName: (id) => (id === LABEL ? 'customer' : undefined),
  issueKey: (id) => (id === EPIC ? 'PLT-1' : undefined),
};

describe('compileColorRules', () => {
  it('paints with the first rule a card matches', () => {
    const color = compileColorRules(
      [
        { query: 'priority = Highest', color: '#c42d2d' },
        { query: 'type = Bug AND label = customer', color: '#e0632a' },
        { query: 'statusCategory = in_progress', color: '#2456c9' },
      ],
      names,
    );
    expect(color(card(1, { priority: 'highest', labelIds: [LABEL] }))).toBe('#c42d2d');
    expect(color(card(2, { labelIds: [LABEL] }))).toBe('#e0632a');
    expect(color(card(3, { statusId: STATUS.doing }))).toBe('#2456c9');
    expect(color(card(4))).toBeNull();
  });

  it('reads me, epics, emptiness and lists from the card', () => {
    const color = compileColorRules(
      [
        { query: 'assignee = me', color: '#111111' },
        { query: 'epic = PLT-1 AND estimate >= 3', color: '#222222' },
        { query: 'assignee IS EMPTY', color: '#333333' },
      ],
      names,
    );
    expect(color(card(1, { assigneeId: ME }))).toBe('#111111');
    expect(color(card(2, { estimate: 5 }))).toBe('#222222');
    expect(color(card(3, { estimate: 1 }))).toBe('#333333');
  });

  it('skips rules that do not parse and fields a card does not carry', () => {
    const color = compileColorRules(
      [
        { query: 'priority = ', color: '#111111' },
        { query: 'updated >= -1d', color: '#222222' },
        { query: 'NOT priority = Low', color: '#333333' },
      ],
      names,
    );
    expect(color(card(1))).toBe('#333333');
    expect(color(card(2, { priority: 'low' }))).toBeNull();
  });
});
