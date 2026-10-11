import type { MockDb } from '../db.ts';
import type { MockIssue } from '../seed/work-board.ts';
import { compileLql, type LqlContext } from './work-board-lql.ts';
import { mockEpicColor } from './work-backlog-state.ts';
import { sprintsOf } from './work-board-delegate.ts';
import { boardState, projectRef, projectsOf, workflowOf } from './work-board-state.ts';
import { workState, type Row } from './work-state.ts';

/*
 * GET /work/boards/:id/view and /metrics over the mock's issues, grouped the way the server's
 * boards service groups them: columns by status, lanes by the board's lane kind, cards in
 * rank order, Kanban done cards for fourteen days and Scrum cards from the active sprint.
 */

interface Column {
  id: string;
  statusIds: string[];
  wipLimit: number | null;
  done?: boolean;
}

const DAY = 86_400_000;
const PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest'];

export function lqlContext(db: MockDb): LqlContext {
  const statuses = (workflowOf(db)?.['statuses'] as Row[] | undefined) ?? [];
  const status = (id: string) => statuses.find((entry) => entry.id === id);
  const { issues, labels } = boardState(db);
  const sprints = projectsOf(db).flatMap((project) => sprintsOf(db, String(project['key'])));
  return {
    meId: db.signedInAs,
    statusName: (id) => String(status(id)?.['name'] ?? ''),
    statusCategory: (id) => String(status(id)?.['category'] ?? ''),
    typeName: (id) => String(workState(db).issueTypes.find((t) => t.id === id)?.['name'] ?? ''),
    userName: (id) => db.users.find((user) => user.id === id)?.name ?? null,
    labelName: (id) => String(labels.find((label) => label.id === id)?.['name'] ?? ''),
    issueKey: (id) => issues.find((issue) => issue.id === id)?.key ?? null,
    sprintName: (id) => String(sprints.find((sprint) => sprint.id === id)?.['name'] ?? '') || null,
  };
}

const isEpic = (db: MockDb, issue: MockIssue) =>
  workState(db).issueTypes.find((type) => type.id === issue.typeId)?.['level'] === 'epic';

function inScope(db: MockDb, project: Row, sprintId: string | null) {
  const done = new Set(
    ((workflowOf(db)?.['statuses'] as Row[] | undefined) ?? [])
      .filter((status) => status['category'] === 'done')
      .map((status) => status.id),
  );
  return (issue: MockIssue) => {
    if (issue.projectId !== project.id || isEpic(db, issue)) return false;
    if (project['method'] === 'scrum') return sprintId !== null && issue.sprintId === sprintId;
    return !done.has(issue.statusId) || Date.now() - Date.parse(issue.statusChangedAt) < 14 * DAY;
  };
}

function laneOf(kind: string, issue: MockIssue): string {
  if (kind === 'epic') return issue.parentId ?? 'none';
  if (kind === 'assignee') return issue.assigneeId ?? 'none';
  if (kind === 'priority') return issue.priority;
  if (kind === 'type') return issue.typeId;
  return 'all';
}

function lanes(db: MockDb, kind: string, used: Set<string>) {
  const lane = (id: string, label: string, extra: Partial<Row> = {}) => ({
    id,
    label,
    color: null,
    issueKey: null,
    dueAt: null,
    ...extra,
  });
  const all = (() => {
    if (kind === 'epic') {
      const epics = boardState(db).issues.filter((issue) => isEpic(db, issue));
      return [
        ...epics.map((e) =>
          lane(e.id, e.title, {
            issueKey: e.key,
            dueAt: e.dueAt,
            color: mockEpicColor(
              epics.filter((other) => other.projectId === e.projectId),
              e.id,
            ),
          }),
        ),
        lane('none', 'No epic'),
      ];
    }
    if (kind === 'assignee')
      return [...db.users.map((u) => lane(u.id, u.name)), lane('none', 'Unassigned')];
    if (kind === 'priority')
      return PRIORITIES.map((p) => lane(p, p.charAt(0).toUpperCase() + p.slice(1)));
    if (kind === 'type') return workState(db).issueTypes.map((t) => lane(t.id, String(t['name'])));
    return [lane('all', 'All issues')];
  })();
  return all.filter((entry) => used.has(entry.id));
}

export function boardMetrics(db: MockDb, board: Row, cards: MockIssue[], sprintId: string | null) {
  const config = board['config'] as { columns: Column[] };
  const doneIds = new Set(config.columns.filter((c) => c.done).flatMap((c) => c.statusIds));
  const firstIds = new Set(config.columns[0]?.statusIds ?? []);
  const points = (list: MockIssue[]) => list.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0);
  const isKanban = board.id === boardState(db).supBoard.id;
  return {
    throughputPerWeek: isKanban ? 11 : 6,
    cycleTimeDays: isKanban ? 3.4 : 4.1,
    wipCount: cards.filter((c) => !doneIds.has(c.statusId) && !firstIds.has(c.statusId)).length,
    committedPoints: sprintId ? points(cards) : 0,
    completedPoints: sprintId ? points(cards.filter((c) => doneIds.has(c.statusId))) : 0,
    throughputHistory: isKanban ? [7, 9, 8, 10, 9, 13, 11, 12] : [5, 6, 4, 7, 6, 5, 7, 6],
  };
}

/** The board view, or an LQL problem in `q` the way the server reports a bad query. */
export function boardView(db: MockDb, board: Row, q: string | null) {
  const project = projectRef(db, String(board['projectId']));
  if (!project) return { ok: false, error: 'The board has no project' } as const;
  const { issues } = boardState(db);
  const sprints = sprintsOf(db, String(project['key']));
  const sprintId =
    project['method'] === 'scrum'
      ? (sprints.find((s) => s['projectId'] === project.id && s['state'] === 'active')?.id ?? null)
      : null;
  const config = board['config'] as { columns: Column[]; lanes: { kind: string } };
  const columnOf = new Map(config.columns.flatMap((c) => c.statusIds.map((id) => [id, c.id])));
  const filter = q ? compileLql(q, lqlContext(db)) : null;
  if (filter && !filter.ok) return { ok: false, error: filter.error.message } as const;
  const scoped = issues.filter(inScope(db, project, sprintId));
  const shown = scoped
    .filter((issue) => columnOf.has(issue.statusId) && (!filter || filter.test(issue)))
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
  const kind = config.lanes.kind;
  const cards = shown.map((issue) => ({
    issueId: issue.id,
    key: issue.key,
    title: issue.title,
    typeId: issue.typeId,
    statusId: issue.statusId,
    priority: issue.priority,
    assigneeId: issue.assigneeId,
    estimate: issue.estimate,
    labelIds: issue.labelIds,
    rank: issue.rank,
    blockedBy: issue.blockedBy,
    dueAt: issue.dueAt,
    subtasks: issue.subtasks,
    parentId: issue.parentId,
    docs: issue.docs,
    ageDays: Math.floor((Date.now() - Date.parse(issue.statusChangedAt)) / DAY),
    columnId: columnOf.get(issue.statusId) ?? '',
    laneId: laneOf(kind, issue),
  }));
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(card.columnId, (counts.get(card.columnId) ?? 0) + 1);
  return {
    ok: true,
    view: {
      board,
      sprintId,
      columns: config.columns.map((column) => {
        const count = counts.get(column.id) ?? 0;
        const wipLimit = column.wipLimit ?? null;
        return { id: column.id, count, wipLimit, overWip: wipLimit !== null && count > wipLimit };
      }),
      lanes: lanes(db, kind, new Set(cards.map((card) => card.laneId))),
      cards,
      metrics: boardMetrics(db, board, scoped, sprintId),
    },
  } as const;
}
