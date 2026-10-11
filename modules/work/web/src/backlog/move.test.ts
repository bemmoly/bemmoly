import { describe, expect, it } from 'vitest';
import { id, keysOf, sampleBacklog } from './fixtures.test-helper.ts';
import { BACKLOG_ID } from './model.ts';
import { inScreenOrder, insertionIndex, planMove, reconcileIssue } from './move.ts';

const issueId = (n: number) => id(0xb00 + n);
const visible = (backlog: ReturnType<typeof sampleBacklog>, containerId: string) =>
  (containerId === BACKLOG_ID
    ? backlog.issues
    : (backlog.sprints.find((entry) => entry.sprint.id === containerId)?.issues ?? [])
  ).map((issue) => issue.id);

describe('planMove', () => {
  it('reorders within a sprint and names the new neighbours without a sprint change', () => {
    const backlog = sampleBacklog();
    const s14 = backlog.sprints[0]!.sprint.id;
    const plan = planMove(backlog, [issueId(3)], { containerId: s14, beforeId: issueId(1) }, [
      ...visible(backlog, s14),
    ]);
    expect(keysOf(plan!.backlog.sprints[0]!.issues)).toEqual(['PLT-3', 'PLT-1', 'PLT-2']);
    expect(plan!.calls).toEqual([
      {
        issueId: issueId(3),
        key: 'PLT-3',
        body: { beforeIssueId: null, afterIssueId: issueId(1) },
      },
    ]);
    const ranks = plan!.backlog.sprints[0]!.issues.map((issue) => issue.rank);
    expect([...ranks].sort()).toEqual(ranks);
  });

  it('moves from the backlog into a sprint, sending the sprint and updating its points', () => {
    const backlog = sampleBacklog();
    const s15 = backlog.sprints[1]!.sprint.id;
    const plan = planMove(backlog, [issueId(6)], { containerId: s15, beforeId: null }, [
      ...visible(backlog, s15),
    ])!;
    expect(keysOf(plan.backlog.sprints[1]!.issues)).toEqual(['PLT-4', 'PLT-6']);
    expect(keysOf(plan.backlog.issues)).toEqual(['PLT-5', 'PLT-7']);
    expect(plan.backlog.sprints[1]).toMatchObject({ committedPoints: 2, committedIssues: 2 });
    expect(plan.backlog.sprints[1]!.issues[1]!.sprintId).toBe(s15);
    expect(plan.calls[0]!.body).toEqual({
      beforeIssueId: issueId(4),
      afterIssueId: null,
      sprintId: s15,
    });
  });

  it('moves a multi-selection as a block in screen order, chaining each call on the last', () => {
    const backlog = sampleBacklog();
    const plan = planMove(
      backlog,
      [issueId(7), issueId(2)],
      { containerId: BACKLOG_ID, beforeId: issueId(5) },
      visible(backlog, BACKLOG_ID),
    )!;
    expect(keysOf(plan.backlog.issues)).toEqual(['PLT-2', 'PLT-7', 'PLT-5', 'PLT-6']);
    expect(keysOf(plan.backlog.sprints[0]!.issues)).toEqual(['PLT-1', 'PLT-3']);
    expect(plan.calls.map((call) => [call.key, call.body])).toEqual([
      ['PLT-2', { beforeIssueId: null, afterIssueId: issueId(5), sprintId: null }],
      ['PLT-7', { beforeIssueId: issueId(2), afterIssueId: issueId(5) }],
    ]);
  });

  it('returns nothing for a drop that changes nothing', () => {
    const backlog = sampleBacklog();
    const s14 = backlog.sprints[0]!.sprint.id;
    const ids = visible(backlog, s14);
    expect(planMove(backlog, [issueId(2)], { containerId: s14, beforeId: issueId(3) }, ids)).toBe(
      null,
    );
    expect(planMove(backlog, [issueId(2)], { containerId: s14, beforeId: issueId(2) }, ids)).toBe(
      null,
    );
    expect(planMove(backlog, [], { containerId: s14, beforeId: null }, ids)).toBe(null);
  });

  it('drops into an empty sprint with no neighbours', () => {
    const backlog = sampleBacklog();
    backlog.sprints[1]!.issues = [];
    const s15 = backlog.sprints[1]!.sprint.id;
    const plan = planMove(backlog, [issueId(5)], { containerId: s15, beforeId: null }, [])!;
    expect(plan.calls[0]!.body).toEqual({ beforeIssueId: null, afterIssueId: null, sprintId: s15 });
  });
});

describe('insertionIndex', () => {
  const backlog = sampleBacklog();
  const rest = backlog.issues;

  it('lands above the named row, skipping rows that are moving', () => {
    expect(insertionIndex(rest, visible(backlog, BACKLOG_ID), new Set(), issueId(6))).toBe(1);
    const moving = new Set([issueId(6)]);
    const others = rest.filter((issue) => !moving.has(issue.id));
    expect(insertionIndex(others, visible(backlog, BACKLOG_ID), moving, issueId(6))).toBe(1);
  });

  it('lands below the last visible row when a filter hides the rest', () => {
    expect(insertionIndex(rest, [issueId(5)], new Set(), null)).toBe(1);
    expect(insertionIndex(rest, [], new Set(), null)).toBe(3);
  });
});

describe('inScreenOrder and reconcileIssue', () => {
  it('orders ids top to bottom whatever order they were picked in', () => {
    const backlog = sampleBacklog();
    expect(inScreenOrder(backlog, [issueId(6), issueId(1), issueId(4)])).toEqual([
      issueId(1),
      issueId(4),
      issueId(6),
    ]);
  });

  it('replaces the provisional copy with the server answer', () => {
    const backlog = sampleBacklog();
    const server = { ...backlog.issues[0]!, rank: 'fn' };
    expect(reconcileIssue(backlog, server).issues[0]!.rank).toBe('fn');
  });
});
