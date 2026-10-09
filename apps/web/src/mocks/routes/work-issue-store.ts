import type { MockDb } from '../db.ts';
import { seedBoardLabels, BOARD_IDS } from '../seed/work-board.ts';
import { seedLabels } from '../seed/work-issues.ts';
import { WORK_IDS } from '../seed/work-settings.ts';
import { lastNumbers, seedWorkIssues, seedWorkSprints } from '../seed/work-store.ts';
import type { Row } from './work-state.ts';

/*
 * The one store of Work issues, sprints and labels that the issue, backlog
 * and board mocks all read and write, with one key counter per project, as
 * the server has one issues table. Kept per mock database like the settings
 * rows, so a scenario reset starts it over. The arrays are shared by
 * reference: callers mutate them in place and never replace them.
 */

export interface IssueStore {
  issues: Row[];
  sprints: Row[];
  labels: Row[];
  /** Project id to the last issue number handed out. */
  counters: Record<string, number>;
}

const stores = new WeakMap<MockDb, IssueStore>();

function labels(): Row[] {
  const rows = [
    ...seedLabels(),
    ...seedBoardLabels(WORK_IDS.project),
    ...seedBoardLabels(BOARD_IDS.supProject, ['customer']),
  ] as Row[];
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = `${String(row['projectId'])}:${row.id}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function issueStore(db: MockDb): IssueStore {
  let store = stores.get(db);
  if (!store) {
    const issues = seedWorkIssues();
    store = {
      issues,
      sprints: seedWorkSprints() as unknown as Row[],
      labels: labels(),
      counters: lastNumbers(issues),
    };
    stores.set(db, store);
  }
  return store;
}

/** The next gap-free number and key for a project, taken from the shared counter. */
export function nextKey(db: MockDb, project: Row): { number: number; key: string } {
  const { counters } = issueStore(db);
  const number = (counters[project.id] ?? 0) + 1;
  counters[project.id] = number;
  return { number, key: `${String(project['key'])}-${number}` };
}

/** What a board card reads beyond the issue schema, for an issue created in the mock. */
export const cardFields = () => ({ blockedBy: [], docs: [], subtasks: null });

/** Removes a row from a shared array in place, so every holder of the array sees it go. */
export function removeFrom<T>(rows: T[], row: T): void {
  const index = rows.indexOf(row);
  if (index >= 0) rows.splice(index, 1);
}
