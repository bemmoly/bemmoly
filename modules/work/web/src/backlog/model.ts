import type {
  Backlog,
  BoardConfig,
  EpicProgress,
  Issue,
  IssueType as WorkIssueType,
  Sprint,
  WorkflowStatus,
} from '@bemmoly/module-work/shared';
import {
  avatarHue,
  epicColor,
  epicFill,
  initialsOf,
  type EpicColor,
  type AvatarHue,
  type IssueTypeRef,
  type StatusCategory,
} from '@bemmoly/ui';
import { matchesFilters, type IssueFilters } from '../shared/issue-filters.ts';

/*
 * The Backlog screen as plain data: containers in screen order, the names
 * and colours each row is painted with, and the filters the toolbar and the
 * epic panel apply. No React here, so every rule is a unit test.
 */

/** The container id of the unsprinted list; sprint containers use the sprint's id. */
export const BACKLOG_ID = 'backlog';

export interface Container {
  id: string;
  sprint: Sprint | null;
  /** Every issue the container holds, in rank order. */
  issues: Issue[];
  committedPoints: number;
}

export interface StatusLook {
  label: string;
  category: StatusCategory;
  done: boolean;
}

export interface PersonLook {
  name: string;
  initials: string;
  hue: AvatarHue;
}

export interface EpicLook extends EpicProgress {
  /** The colour stored on the epic, the same one the Board and the Issue page paint. */
  look: EpicColor;
  colorClassName: string;
}

export interface Lookups {
  statuses: ReadonlyMap<string, StatusLook>;
  types: ReadonlyMap<string, IssueTypeRef>;
  people: ReadonlyMap<string, PersonLook>;
  epics: ReadonlyMap<string, EpicLook>;
}

export function containersOf(backlog: Backlog): Container[] {
  return [
    ...backlog.sprints.map((entry) => ({
      id: entry.sprint.id,
      sprint: entry.sprint,
      issues: entry.issues,
      committedPoints: entry.committedPoints,
    })),
    { id: BACKLOG_ID, sprint: null, issues: backlog.issues, committedPoints: 0 },
  ];
}

/** The tracks after "in progress" in the mock: the second is review, the third and later QA. */
const LATER: StatusCategory[] = ['progress', 'review', 'qa'];

/**
 * A status reads as the board column that holds it ("In review" for Code
 * review), as the mock's rows do; statuses no column holds keep their name.
 * The badge colour follows the column's place among the in-progress columns.
 */
export function statusLooks(
  statuses: readonly WorkflowStatus[],
  config: Pick<BoardConfig, 'columns'> | null,
): Map<string, StatusLook> {
  const byId = new Map(statuses.map((status) => [status.id, status]));
  const looks = new Map<string, StatusLook>();
  let working = 0;
  for (const column of config?.columns ?? []) {
    const held = column.statusIds.map((id) => byId.get(id)).filter((s) => s !== undefined);
    const todo = held.length > 0 && held.every((status) => status.category === 'todo');
    const category: StatusCategory = column.done
      ? 'done'
      : todo
        ? 'todo'
        : (LATER[Math.min(working++, LATER.length - 1)] ?? 'progress');
    for (const status of held) {
      looks.set(status.id, { label: column.name, category, done: Boolean(column.done) });
    }
  }
  for (const status of statuses) {
    if (looks.has(status.id)) continue;
    const category = status.category === 'in_progress' ? 'progress' : status.category;
    looks.set(status.id, { label: status.name, category, done: status.category === 'done' });
  }
  return looks;
}

/** Each type as stored, so a custom type draws its own icon and colour. */
export function typeLooks(types: readonly WorkIssueType[]): Map<string, IssueTypeRef> {
  return new Map(types.map((type) => [type.id, type]));
}

/** The signed-in person wears the accent, as RS does in every mock. */
export function personLooks(
  users: readonly { id: string; name: string }[],
  meId: string | undefined,
): Map<string, PersonLook> {
  return new Map(
    users.map((user) => [
      user.id,
      {
        name: user.name,
        initials: initialsOf(user.name),
        hue: user.id === meId ? 'accent' : avatarHue(user.id),
      },
    ]),
  );
}

export function epicLooks(epics: readonly EpicProgress[]): Map<string, EpicLook> {
  return new Map(
    epics.map((epic) => {
      const look = epicColor(epic.color, epic.id);
      return [epic.id, { ...epic, look, colorClassName: epicFill(look) }];
    }),
  );
}

/** Points when the epic is estimated, issue counts otherwise. */
export function epicPercent(epic: EpicProgress): number {
  if (epic.totalPoints > 0) return (epic.donePoints / epic.totalPoints) * 100;
  return epic.total > 0 ? (epic.done / epic.total) * 100 : 0;
}

export function epicMeta(epic: EpicProgress): string {
  const issues = `${epic.total} ${epic.total === 1 ? 'issue' : 'issues'}`;
  return `${issues} · ${epic.done === 0 ? 'not started' : `${epic.done} done`}`;
}

/** Whether a row passes the shared filters; its blockers come with the backlog. */
export function issueMatches(
  issue: Issue,
  filters: IssueFilters,
  meId: string | undefined,
  blocked: boolean,
): boolean {
  return matchesFilters(
    {
      key: issue.key,
      title: issue.title,
      assigneeId: issue.assigneeId,
      parentId: issue.parentId,
      typeId: issue.typeId,
      labelIds: issue.labelIds,
      blocked,
      updatedAt: issue.updatedAt,
    },
    filters,
    meId,
  );
}

export interface Counts {
  todo: number;
  doing: number;
  done: number;
}

export function countsOf(issues: readonly Issue[], statuses: Lookups['statuses']): Counts {
  const counts = { todo: 0, doing: 0, done: 0 };
  for (const issue of issues) {
    const look = statuses.get(issue.statusId);
    if (look?.done) counts.done += 1;
    else if (!look || look.category === 'todo') counts.todo += 1;
    else counts.doing += 1;
  }
  return counts;
}

export function points(issues: readonly Issue[]): number {
  return Math.round(issues.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0) * 100) / 100;
}

const DAY = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Sep 23 – Oct 7", or nothing for a sprint that has no dates yet. */
export function sprintDates(sprint: Sprint): string | undefined {
  if (!sprint.startsAt || !sprint.endsAt) return undefined;
  return `${DAY.format(new Date(sprint.startsAt))} – ${DAY.format(new Date(sprint.endsAt))}`;
}

/** "PLT Sprint 16": one past the highest number among the sprint names it can see. */
export function nextSprintName(projectKey: string, sprints: readonly { name: string }[]): string {
  const numbers = sprints.map((sprint) => Number(/(\d+)\s*$/.exec(sprint.name)?.[1] ?? 0));
  return `${projectKey} Sprint ${Math.max(0, ...numbers) + 1}`;
}
