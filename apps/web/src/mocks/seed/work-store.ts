import { ago } from './time.ts';
import { seedBacklogIssues, seedBacklogSprints } from './work-backlog.ts';
import { seedPlatformIssues } from './work-board-plt.ts';
import { seedSupportIssues } from './work-board-sup.ts';
import { seedIssues, type Row } from './work-issues.ts';

/*
 * One set of Work issues for every mock screen. The Issue, Backlog and Board
 * mocks each describe some of the same issues by key; they are folded into
 * one row per key, the Issue page's details first, then the Backlog's
 * planning, then the Board's status and rank on top, so each screen still
 * shows its mock while a change made on one shows on the others.
 */

/** Every field the issue schema and the board's cards read, for rows a seed leaves out. */
const BLANK = {
  description: null,
  descriptionText: '',
  priority: 'medium',
  assigneeId: null,
  reporterId: null,
  parentId: null,
  sprintId: null,
  estimate: null,
  dueAt: null,
  fixVersionId: null,
  componentId: null,
  customFields: {},
  labelIds: [],
  resolvedAt: null,
  deletedAt: null,
  blockedBy: [],
  docs: [],
  subtasks: null,
} as const;

function overlay(target: Row, source: Row): void {
  for (const [field, value] of Object.entries(source)) {
    if (field === 'id' || value === null || value === undefined) continue;
    target[field] =
      field === 'customFields'
        ? { ...(target[field] as object), ...(value as object) }
        : structuredClone(value);
  }
}

export function seedWorkIssues(): Row[] {
  const sources = [seedIssues(), seedBacklogIssues(), seedPlatformIssues(), seedSupportIssues()];
  const byKey = new Map<string, Row>();
  /** Each seed's id for an issue, to the id the merged row keeps. */
  const canonical = new Map<string, string>();
  for (const row of sources.flat() as Row[]) {
    const key = String(row['key']);
    const found = byKey.get(key);
    if (found) {
      canonical.set(row.id, found.id);
      overlay(found, row);
      continue;
    }
    const merged: Row = {
      ...structuredClone(BLANK),
      number: Number(key.split('-')[1]),
      createdAt: ago(60 * 24 * 20),
      id: row.id,
    };
    overlay(merged, row);
    merged['statusChangedAt'] ??= merged['updatedAt'];
    byKey.set(key, merged);
    canonical.set(row.id, row.id);
  }
  const issues = [...byKey.values()];
  for (const issue of issues) {
    const parent = issue['parentId'] as string | null;
    if (parent) issue['parentId'] = canonical.get(parent) ?? parent;
  }
  return issues;
}

/** The sprints every screen plans with: the Backlog mock's, under the issue mock's ids. */
export const seedWorkSprints = seedBacklogSprints;

/** The highest number each project has used, so a new issue continues the sequence. */
export function lastNumbers(issues: Row[]): Record<string, number> {
  const last: Record<string, number> = {};
  for (const issue of issues) {
    const project = String(issue['projectId']);
    last[project] = Math.max(last[project] ?? 0, Number(issue['number']) || 0);
  }
  return last;
}
