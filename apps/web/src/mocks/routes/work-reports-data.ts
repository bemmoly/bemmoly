import type { MockDb } from '../db.ts';
import { STATUS_IDS } from '../seed/work-settings.ts';
import { askIssueMock } from './work-board-delegate.ts';
import { issueStore } from './work-issue-store.ts';
import { projectOf } from './work-issues.ts';
import { workState, type Row } from './work-state.ts';

/*
 * What the Reports mock draws from: the demo's own projects, issues, sprints and people, plus
 * a seeded random walk for the history the mock does not keep. The same project and day give
 * the same numbers, so the demo reads the same on every visit.
 */

export const DAY = 86_400_000;
export const WEEK = 7 * DAY;

export const isoDay = (instant: number) => new Date(instant).toISOString().slice(0, 10);

/** A small deterministic generator, seeded per report so each one has its own shape. */
export function seeded(seed: string) {
  let state = [...seed].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;

type Category = 'todo' | 'in_progress' | 'done';

const CATEGORY: Record<string, Category> = {
  [STATUS_IDS.Backlog]: 'todo',
  [STATUS_IDS.Selected]: 'todo',
  [STATUS_IDS['In progress']]: 'in_progress',
  [STATUS_IDS['Code review']]: 'in_progress',
  [STATUS_IDS['Design review']]: 'in_progress',
  [STATUS_IDS.Testing]: 'in_progress',
  [STATUS_IDS.Done]: 'done',
  [STATUS_IDS["Won't do"]]: 'done',
  [STATUS_IDS.Duplicate]: 'done',
};

export const STATUS_LIST = (Object.entries(STATUS_IDS) as [string, string][]).map(([name, id]) => ({
  id,
  name,
  category: CATEGORY[id] ?? 'todo',
}));

export const categoryOf = (statusId: unknown): Category => CATEGORY[String(statusId)] ?? 'todo';

export interface ReportContext {
  project: Row;
  key: string;
  issues: Row[];
  now: number;
}

export function reportContext(db: MockDb, ref: string | undefined): ReportContext | null {
  const project = projectOf(db, ref ?? '');
  if (!project) return null;
  const issues = issueStore(db).issues.filter(
    (issue) => issue['projectId'] === project.id && !issue['deletedAt'],
  );
  return { project, key: String(project['key']), issues, now: Date.now() };
}

export const points = (issue: Row) => Number(issue['estimate'] ?? 0);
export const isDone = (issue: Row) => categoryOf(issue['statusId']) === 'done';

export const sprintRows = (db: MockDb) => issueStore(db).sprints;

export function versionRows(db: MockDb, key: string): Row[] {
  const response = askIssueMock('GET', '/projects/:key/versions', { params: { key } }, db);
  const body = response?.body as { items?: Row[] } | undefined;
  return body?.items ?? [];
}

export const epicTypeIds = (db: MockDb) =>
  new Set(
    workState(db)
      .issueTypes.filter((type) => type['level'] === 'epic')
      .map((type) => type.id),
  );

export const userName = (db: MockDb, id: unknown) =>
  db.users.find((user) => user.id === id)?.name ?? 'Unknown';

/** A stable pick of a version for an issue the demo store has none for. */
export function versionOf(issue: Row, versions: readonly Row[]): Row | null {
  if (versions.length === 0) return null;
  const pick = seeded(issue.id)();
  return pick < 0.25
    ? null
    : (versions[Math.floor(pick * versions.length) % versions.length] ?? null);
}

/** The end of each of the last `count` days, the last one now. */
export function dayCutoffs(now: number, count: number): number[] {
  const today = Date.parse(`${isoDay(now)}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, index) =>
    Math.min(today - (count - 1 - index) * DAY + DAY - 1, now),
  );
}
