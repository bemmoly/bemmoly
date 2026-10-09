import type { AvailableTransition } from '@bemmoly/module-work/shared';
import { describe, expect, it } from 'vitest';
import { applyMove, judgeColumn, planMove, stepTarget } from './board-drag.ts';
import { EPIC, STATUS, testView } from './board-fixtures.ts';
import { buildBoardModel, locateCard } from './board-model.ts';

const view = testView();
const model = buildBoardModel(view);
const column = (id: string) => {
  const found = model.columns.find((entry) => entry.id === id);
  if (!found) throw new Error(`no column ${id}`);
  return found;
};
const place = (issueId: string) => {
  const found = locateCard(model, issueId);
  if (!found) throw new Error(`no card ${issueId}`);
  return found;
};
const cardOf = (key: string) => {
  const found = view.cards.find((entry) => entry.key === key);
  if (!found) throw new Error(`no card ${key}`);
  return found;
};

const transition = (fields: Partial<AvailableTransition>): AvailableTransition => ({
  id: '018f0000-0000-7000-8000-000000000999',
  name: 'Start work',
  toStatusId: STATUS.doing,
  toStatusName: 'In progress',
  toStatusCategory: 'in_progress',
  available: true,
  blockedBy: [],
  ...fields,
});

describe('judgeColumn', () => {
  it('keeps the status when the card stays in its column', () => {
    expect(judgeColumn(column('todo'), STATUS.selected, [])).toEqual({
      allowed: true,
      statusId: STATUS.selected,
    });
  });

  it('offers the first status while the transitions are not known yet', () => {
    expect(judgeColumn(column('doing'), STATUS.selected, undefined)).toEqual({
      allowed: true,
      statusId: STATUS.doing,
    });
  });

  it('allows a column an available transition reaches', () => {
    expect(judgeColumn(column('doing'), STATUS.selected, [transition({})])).toEqual({
      allowed: true,
      statusId: STATUS.doing,
    });
  });

  it('names the reason when the only transition is blocked', () => {
    const blocked = transition({ available: false, blockedBy: ['Link a pull request first.'] });
    expect(judgeColumn(column('doing'), STATUS.selected, [blocked])).toEqual({
      allowed: false,
      reason: 'Link a pull request first.',
    });
  });

  it('refuses a column no transition leads to', () => {
    expect(judgeColumn(column('done'), STATUS.selected, [transition({})])).toEqual({
      allowed: false,
      reason: 'No transition leads from this status to Done',
    });
  });
});

describe('planMove', () => {
  it('reorders within a column between the new neighbours', () => {
    const card = cardOf('PLT-11');
    const plan = planMove(
      model,
      card,
      place(card.issueId),
      { laneId: EPIC, columnId: 'todo', index: 0 },
      STATUS.selected,
    );
    expect(plan).toMatchObject({
      statusId: null,
      beforeIssueId: null,
      afterIssueId: cardOf('PLT-10').issueId,
    });
    expect(plan && plan.rank < 'b').toBe(true);
  });

  it('is a no-op when the card is dropped where it was', () => {
    const card = cardOf('PLT-10');
    expect(
      planMove(model, card, place(card.issueId), place(card.issueId), STATUS.selected),
    ).toBeNull();
  });

  it('transitions into another column and ranks between its cards', () => {
    const card = cardOf('PLT-10');
    const plan = planMove(
      model,
      card,
      place(card.issueId),
      { laneId: EPIC, columnId: 'doing', index: 1 },
      STATUS.doing,
    );
    expect(plan).toMatchObject({
      statusId: STATUS.doing,
      beforeIssueId: cardOf('PLT-12').issueId,
      afterIssueId: cardOf('PLT-13').issueId,
      toColumnId: 'doing',
    });
    expect(plan && plan.rank > 'c' && plan.rank < 'e').toBe(true);
  });
});

describe('applyMove', () => {
  it('moves the card, recounts the columns and flags WIP', () => {
    const card = cardOf('PLT-10');
    const plan = planMove(
      model,
      card,
      place(card.issueId),
      { laneId: EPIC, columnId: 'doing', index: 2 },
      STATUS.doing,
    );
    if (!plan) throw new Error('expected a plan');
    const next = applyMove(view, plan);
    const moved = next.cards.find((entry) => entry.issueId === card.issueId);
    expect(moved).toMatchObject({ columnId: 'doing', statusId: STATUS.doing, ageDays: 0 });
    expect(next.columns.find((entry) => entry.id === 'doing')).toMatchObject({
      count: 3,
      overWip: true,
    });
    expect(next.columns.find((entry) => entry.id === 'todo')?.count).toBe(2);
    const cell = buildBoardModel(next).lanes[0]?.cells['doing']?.map((entry) => entry.key);
    expect(cell).toEqual(['PLT-12', 'PLT-13', 'PLT-10']);
  });
});

describe('stepTarget', () => {
  const { laneId, columnId, index } = place(cardOf('PLT-10').issueId);
  const from = { laneId, columnId, index };
  const id = cardOf('PLT-10').issueId;

  it('moves down within the cell but not past its end', () => {
    const once = stepTarget(model, id, from, 'ArrowDown');
    expect(once.index).toBe(1);
    expect(stepTarget(model, id, once, 'ArrowDown').index).toBe(1);
  });

  it('moves to the neighbouring column of the same lane and stops at the edge', () => {
    const right = stepTarget(model, id, from, 'ArrowRight');
    expect(right).toEqual({ laneId: EPIC, columnId: 'doing', index: 0 });
    expect(stepTarget(model, id, from, 'ArrowLeft')).toEqual(from);
  });
});

describe('buildBoardModel', () => {
  it('splits lanes into rank-ordered cells with points and progress', () => {
    const [epic, none] = model.lanes;
    expect(epic?.cells['todo']?.map((entry) => entry.key)).toEqual(['PLT-10', 'PLT-11']);
    expect(epic).toMatchObject({ count: 5, points: 12, donePoints: 5, inFlight: 2, hue: 0 });
    expect(none).toMatchObject({ label: 'No epic', count: 1, hue: null });
  });

  it('puts every card in one lane when grouping is off', () => {
    const flat = buildBoardModel(view, 'none');
    expect(flat.lanes).toHaveLength(1);
    expect(flat.lanes[0]?.cells['todo']?.map((entry) => entry.key)).toEqual([
      'PLT-10',
      'PLT-11',
      'PLT-15',
    ]);
  });
});
