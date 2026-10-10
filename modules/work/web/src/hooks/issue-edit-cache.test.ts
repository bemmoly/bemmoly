import type { BoardView, IssueDetail } from '@bemmoly/module-work/shared';
import { describe, expect, it } from 'vitest';
import { id, issue, keysOf, sampleBacklog, sprint } from '../backlog/fixtures.test-helper.ts';
import { card, defaultCards, testView } from './board-fixtures.ts';
import { findIssue, patchBacklog, revertBacklog } from './issue-edit-backlog.ts';
import { patchBoardView, revertBoardView } from './issue-edit-board.ts';
import { patchIssueDetail, revertIssueDetail } from './issue-edit-detail.ts';
import { previousOf, stillHeld } from './issue-edit-patch.ts';

const ME = id(0x990);
const SPRINT = id(0x991);
const s14 = sprint(14).id;
const s15 = sprint(15).id;

const cardOf = (view: BoardView, key: string) => view.cards.find((entry) => entry.key === key);
const countOf = (view: BoardView, columnId: string) =>
  view.columns.find((column) => column.id === columnId)?.count;

describe('stillHeld and previousOf', () => {
  it('names only the fields an entry still holds at the edit', () => {
    const entry = { assigneeId: ME, priority: 'low', sprintId: null };
    expect(stillHeld(entry, { assigneeId: ME, priority: 'high' })).toEqual(['assigneeId']);
    expect(stillHeld({ assigneeId: ME }, { sprintId: null })).toEqual([]);
  });

  it('reads the replaced values, or null when the entry does not carry one', () => {
    expect(previousOf({ assigneeId: null, priority: 'low' }, { priority: 'high' })).toEqual({
      priority: 'low',
    });
    expect(previousOf({ assigneeId: null }, { sprintId: s14 })).toBeNull();
  });
});

describe('board views', () => {
  it('changes the assignee and priority on the card and nothing else', () => {
    const view = testView();
    const next = patchBoardView(view, 'PLT-10', { assigneeId: ME, priority: 'high' });
    expect(cardOf(next, 'PLT-10')).toMatchObject({ assigneeId: ME, priority: 'high' });
    expect(cardOf(next, 'PLT-11')).toBe(cardOf(view, 'PLT-11'));
    expect(patchBoardView(view, 'PLT-99', { priority: 'high' })).toBe(view);
  });

  it('moves the card to its lane when the lanes are by assignee', () => {
    const view = testView([card(10, { laneId: 'none' })]);
    view.board.config.lanes.kind = 'assignee';
    view.lanes = [
      { id: ME, label: 'Me', color: null, issueKey: null, dueAt: null },
      { id: 'none', label: 'Unassigned', color: null, issueKey: null, dueAt: null },
    ];
    const assigned = patchBoardView(view, 'PLT-10', { assigneeId: ME });
    expect(cardOf(assigned, 'PLT-10')?.laneId).toBe(ME);
    const back = revertBoardView(assigned, view.cards[0]!, { assigneeId: ME });
    expect(cardOf(back, 'PLT-10')).toMatchObject({ assigneeId: null, laneId: 'none' });
  });

  it('takes a card moved to another sprint off a sprint board, with its column count', () => {
    const view = { ...testView(), sprintId: SPRINT };
    const next = patchBoardView(view, 'PLT-12', { sprintId: s15 });
    expect(cardOf(next, 'PLT-12')).toBeUndefined();
    expect(countOf(next, 'doing')).toBe(1);
    expect(patchBoardView(view, 'PLT-12', { sprintId: SPRINT })).toEqual(view);
    expect(cardOf(patchBoardView(testView(), 'PLT-12', { sprintId: s15 }), 'PLT-12')).toBeTruthy();
  });

  it('puts a card taken off the board back in its column on a refusal', () => {
    const view = { ...testView(), sprintId: SPRINT };
    const before = cardOf(view, 'PLT-12')!;
    const gone = patchBoardView(view, 'PLT-12', { sprintId: s15 });
    const back = revertBoardView(gone, before, { sprintId: s15 });
    expect(cardOf(back, 'PLT-12')).toEqual(before);
    expect(countOf(back, 'doing')).toBe(2);
    expect(revertBoardView(view, before, { sprintId: s15 })).toBe(view);
  });

  it('leaves a field a later edit changed when taking an edit back', () => {
    const view = testView(defaultCards());
    const before = cardOf(view, 'PLT-10')!;
    const edited = patchBoardView(view, 'PLT-10', { assigneeId: ME, priority: 'high' });
    const later = patchBoardView(edited, 'PLT-10', { priority: 'low' });
    const back = revertBoardView(later, before, { assigneeId: ME, priority: 'high' });
    expect(cardOf(back, 'PLT-10')).toMatchObject({ assigneeId: null, priority: 'low' });
    const settled = patchBoardView(view, 'PLT-10', { priority: 'low' });
    expect(revertBoardView(settled, before, { priority: 'high' })).toBe(settled);
  });
});

describe('backlogs', () => {
  it('changes the fields where the issue is', () => {
    const backlog = sampleBacklog();
    const next = patchBacklog(backlog, 'PLT-2', { assigneeId: ME, priority: 'high' });
    expect(findIssue(next, 'PLT-2')).toMatchObject({ assigneeId: ME, priority: 'high' });
    expect(next.sprints[1]).toBe(backlog.sprints[1]);
    expect(next.issues).toBe(backlog.issues);
    expect(patchBacklog(backlog, 'PLT-99', { priority: 'high' })).toBe(backlog);
  });

  it('moves the issue between containers at its rank and the totals follow', () => {
    const backlog = sampleBacklog();
    const next = patchBacklog(backlog, 'PLT-6', { sprintId: s15 });
    expect(keysOf(next.sprints[1]!.issues)).toEqual(['PLT-4', 'PLT-6']);
    expect(next.sprints[1]).toMatchObject({ committedPoints: 2, committedIssues: 2 });
    expect(keysOf(next.issues)).toEqual(['PLT-5', 'PLT-7']);
    expect(findIssue(next, 'PLT-6')?.sprintId).toBe(s15);
    expect(next.sprints[0]).toBe(backlog.sprints[0]);

    const toBacklog = patchBacklog(backlog, 'PLT-2', { sprintId: null });
    expect(keysOf(toBacklog.sprints[0]!.issues)).toEqual(['PLT-1', 'PLT-3']);
    expect(toBacklog.sprints[0]).toMatchObject({ committedPoints: 2, committedIssues: 2 });
    expect(keysOf(toBacklog.issues)).toEqual(['PLT-2', 'PLT-5', 'PLT-6', 'PLT-7']);
  });

  it('moves between two sprints', () => {
    const next = patchBacklog(sampleBacklog(), 'PLT-4', { sprintId: s14 });
    expect(keysOf(next.sprints[0]!.issues)).toEqual(['PLT-1', 'PLT-2', 'PLT-3', 'PLT-4']);
    expect(next.sprints[1]).toMatchObject({ issues: [], committedPoints: 0, committedIssues: 0 });
  });

  it('takes a failed sprint move back to where the issue was', () => {
    const backlog = sampleBacklog();
    const before = findIssue(backlog, 'PLT-2')!;
    const moved = patchBacklog(backlog, 'PLT-2', { sprintId: null });
    expect(revertBacklog(moved, before, { sprintId: null })).toEqual(backlog);
  });

  it('keeps what a later edit changed and ignores an issue that is gone', () => {
    const backlog = sampleBacklog();
    const before = findIssue(backlog, 'PLT-5')!;
    const edited = patchBacklog(backlog, 'PLT-5', { assigneeId: ME, priority: 'high' });
    const later = patchBacklog(edited, 'PLT-5', { assigneeId: null });
    const back = revertBacklog(later, before, { assigneeId: ME, priority: 'high' });
    expect(findIssue(back, 'PLT-5')).toMatchObject({ assigneeId: null, priority: 'medium' });
    const gone = { ...backlog, issues: backlog.issues.slice(1) };
    expect(revertBacklog(gone, before, { priority: 'high' })).toBe(gone);
  });
});

describe('issue pages', () => {
  const detail = {
    ...issue(4, 'e', { assigneeId: id(0x995), sprintId: s15 }),
    assignee: { id: id(0x995), name: 'Aisha K.', email: 'aisha@acme.test' },
    sprint: { id: s15, name: 'PLT Sprint 15', state: 'future' },
  } as unknown as IssueDetail;

  it('brings the names it knows and clears the ones the edit empties', () => {
    const mine = patchIssueDetail(
      detail,
      { assigneeId: ME, sprintId: null },
      { assignee: { id: ME, name: 'Rohan S.', email: '' } },
    );
    expect(mine).toMatchObject({ assigneeId: ME, sprintId: null, sprint: null });
    expect(mine.assignee?.name).toBe('Rohan S.');
    const unknown = patchIssueDetail(detail, { sprintId: s14 });
    expect(unknown.sprintId).toBe(s14);
    expect(unknown.sprint).toBe(detail.sprint);
  });

  it('takes a failed edit back with its names', () => {
    const edited = patchIssueDetail(detail, { assigneeId: null, priority: 'low' });
    const back = revertIssueDetail(edited, detail, { assigneeId: null, priority: 'low' });
    expect(back).toMatchObject({ assigneeId: id(0x995), priority: 'medium' });
    expect(back.assignee).toBe(detail.assignee);
    expect(revertIssueDetail(detail, detail, { priority: 'low' })).toBe(detail);
  });
});
