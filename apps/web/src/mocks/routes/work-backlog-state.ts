import type { MockDb } from '../db.ts';
import type { BacklogIssueRow, BacklogSprintRow } from '../seed/work-backlog.ts';
import { WORK_IDS } from '../seed/work-settings.ts';
import { issueStore } from './work-issue-store.ts';
import { workState } from './work-state.ts';

/*
 * The Backlog's view of the shared Work issue store: Platform Core's issues
 * and sprints, so a drop here shows in the slide-over and on the Board. The
 * mock keeps ranks short by renumbering the whole project after each drop,
 * the way the server's rebalance job would; only the order is observable.
 */

export interface BacklogState {
  /** Platform Core's issues, a fresh list each call; the rows are the store's own. */
  issues: BacklogIssueRow[];
  /** The store's sprint list itself: add and remove in place. */
  sprints: BacklogSprintRow[];
}

export function backlogState(db: MockDb): BacklogState {
  const store = issueStore(db);
  return {
    issues: store.issues.filter((row) => row['projectId'] === WORK_IDS.project) as never,
    sprints: store.sprints as never,
  };
}

/** "PLT" or the project's id; the mock has the one project the settings seed holds. */
export function projectMatches(ref: string | undefined): boolean {
  return ref === 'PLT' || ref === WORK_IDS.project;
}

const letter = (value: number) => String.fromCharCode(98 + value);

/** Three base-25 digits from "b": room for 15,625 rows with a gap between every two. */
export function rankAt(index: number): string {
  const n = index * 2 + 1;
  return `${letter(Math.floor(n / 625) % 25)}${letter(Math.floor(n / 25) % 25)}${letter(n % 25)}`;
}

export const byRank = (a: BacklogIssueRow, b: BacklogIssueRow) =>
  a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.id < b.id ? -1 : 1;

/** Rewrites every rank in list order. */
export function renumber(issues: BacklogIssueRow[]): void {
  issues.forEach((issue, index) => {
    issue.rank = rankAt(index);
  });
}

function statusCategories(db: MockDb): Map<string, string> {
  const workflow = workState(db).workflows.find((row) => row['projectId'] === WORK_IDS.project);
  const statuses = (workflow?.['statuses'] ?? []) as Array<{ id: string; category: string }>;
  return new Map(statuses.map((status) => [status.id, status.category]));
}

function epicTypeIds(db: MockDb): Set<string> {
  return new Set(
    workState(db)
      .issueTypes.filter((type) => type['level'] === 'epic')
      .map((type) => type.id),
  );
}

/**
 * The colour stored on an epic: the palette in key order within its project, as the server's
 * changeset paints existing epics, so the Board and the Backlog agree.
 */
export function mockEpicColor(epics: readonly { id: string; key: string }[], id: string) {
  const number = (key: string) => Number(key.split('-').pop());
  const ordered = [...epics].sort((a, b) => number(a.key) - number(b.key));
  const index = ordered.findIndex((epic) => epic.id === id);
  return index < 0 ? null : `epic-${(index % 8) + 1}`;
}

const points = (issues: BacklogIssueRow[]) =>
  Math.round(issues.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0) * 100) / 100;

/** The `backlogSchema` response: open sprints, the unsprinted list and the epic panel. */
export function backlogResponse(db: MockDb) {
  const state = backlogState(db);
  const categories = statusCategories(db);
  const epicTypes = epicTypeIds(db);
  const done = (issue: BacklogIssueRow) => categories.get(issue.statusId) === 'done';
  const live = state.issues.filter((issue) => !issue.deletedAt).sort(byRank);
  const open = state.sprints
    .filter((sprint) => sprint.state !== 'closed')
    .sort(
      (a, b) =>
        Number(b.state === 'active') - Number(a.state === 'active') ||
        (a.startsAt ?? '￿').localeCompare(b.startsAt ?? '￿') ||
        a.id.localeCompare(b.id),
    );
  const planned = live.filter((issue) => !epicTypes.has(issue.typeId));
  const allEpics = state.issues.filter((issue) => epicTypes.has(issue.typeId));
  const epics = live.filter((issue) => epicTypes.has(issue.typeId) && !done(issue));
  return {
    projectId: WORK_IDS.project,
    sprints: open.map((sprint) => {
      const held = planned.filter((issue) => issue.sprintId === sprint.id);
      return {
        sprint,
        issues: held,
        committedPoints: points(held),
        committedIssues: held.length,
      };
    }),
    issues: planned.filter((issue) => issue.sprintId === null && !done(issue)),
    blocked: Object.fromEntries(
      live.flatMap((issue) => {
        const keys = (issue as { blockedBy?: string[] }).blockedBy ?? [];
        return keys.length > 0 ? [[issue.id, keys]] : [];
      }),
    ),
    epics: epics.map((epic) => {
      const children = live.filter((issue) => issue.parentId === epic.id);
      const finished = children.filter(done);
      return {
        id: epic.id,
        key: epic.key,
        title: epic.title,
        statusId: epic.statusId,
        color: mockEpicColor(allEpics, epic.id),
        done: finished.length,
        total: children.length,
        donePoints: points(finished),
        totalPoints: points(children),
      };
    }),
  };
}

/** Unfinished issues of a sprint, for completing it. */
export function unfinishedOf(db: MockDb, sprintId: string): BacklogIssueRow[] {
  const categories = statusCategories(db);
  return backlogState(db).issues.filter(
    (issue) =>
      issue.sprintId === sprintId && !issue.deletedAt && categories.get(issue.statusId) !== 'done',
  );
}
