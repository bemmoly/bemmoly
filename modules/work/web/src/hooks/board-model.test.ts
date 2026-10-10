import { describe, expect, it } from 'vitest';
import { applyMove, planMove } from './board-drag.ts';
import { EPIC, STATUS, testView } from './board-fixtures.ts';
import { buildBoardModel, locateCard, shareModel } from './board-model.ts';

const view = testView();
const before = buildBoardModel(view);
const lane = (model: typeof before, id: string) => model.lanes.find((entry) => entry.id === id);

/** PLT-10 dropped from To do into In progress, as the board paints it before the server answers. */
function afterDrop() {
  const card = view.cards.find((entry) => entry.key === 'PLT-10');
  const from = card ? locateCard(before, card.issueId) : null;
  if (!card || !from) throw new Error('no PLT-10');
  const plan = planMove(
    before,
    card,
    from,
    { laneId: EPIC, columnId: 'doing', index: 0 },
    STATUS.doing,
  );
  if (!plan) throw new Error('no move');
  return buildBoardModel(applyMove(view, plan));
}

describe('shareModel', () => {
  it('keeps the old model whole when nothing changed', () => {
    const shared = shareModel(before, buildBoardModel(view));
    expect(shared.columns).toBe(before.columns);
    expect(shared.lanes[0]).toBe(before.lanes[0]);
    expect(shared.lanes[1]).toBe(before.lanes[1]);
  });

  it('hands new cells only to the two a drop touched', () => {
    const shared = shareModel(before, afterDrop());
    const epic = lane(shared, EPIC);
    const old = lane(before, EPIC);
    expect(epic).not.toBe(old);
    expect(epic?.cells['todo']).not.toBe(old?.cells['todo']);
    expect(epic?.cells['doing']).not.toBe(old?.cells['doing']);
    expect(epic?.cells['done']).toBe(old?.cells['done']);
    // The lane the card never left keeps its identity, so it skips rendering.
    expect(lane(shared, 'none')).toBe(lane(before, 'none'));
    expect(epic?.cells['doing']?.map((card) => card.key)).toEqual(['PLT-10', 'PLT-12', 'PLT-13']);
  });

  it('keeps the columns whose counts held and replaces the ones that moved', () => {
    const shared = shareModel(before, afterDrop());
    const column = (id: string) => shared.columns.find((entry) => entry.id === id);
    const old = (id: string) => before.columns.find((entry) => entry.id === id);
    expect(column('done')).toBe(old('done'));
    expect(column('todo')).not.toBe(old('todo'));
    expect(column('doing')?.count).toBe((old('doing')?.count ?? 0) + 1);
  });

  it('takes the new model as it is when there is no old one', () => {
    const next = buildBoardModel(view);
    expect(shareModel(null, next)).toBe(next);
  });
});
