import type { MockDb } from '../db.ts';
import { ago } from '../seed/time.ts';
import { BOARD_IDS, seedBoardLabels, type MockIssue } from '../seed/work-board.ts';
import { seedPlatformIssues } from '../seed/work-board-plt.ts';
import { seedSupportIssues, seedSupportProject } from '../seed/work-board-sup.ts';
import { WORK_IDS } from '../seed/work-settings.ts';
import { issueMockProjects } from './work-board-delegate.ts';
import { workState, type Row } from './work-state.ts';

/*
 * The Board's rows beside the Work settings rows: issues, labels and the Support Desk project
 * with its board. Kept per mock database like work-state, so a scenario reset starts
 * them over. Projects, boards and the workflow are the settings stream's rows where they exist.
 */

export interface BoardState {
  issues: MockIssue[];
  labels: Row[];
  supProject: Row;
  supBoard: Row;
}

const states = new WeakMap<MockDb, BoardState>();

function supportBoard(db: MockDb): Row {
  const plt = workState(db).boards.find((board) => board.id === WORK_IDS.board);
  const config = structuredClone(plt?.['config'] ?? {}) as Record<string, unknown>;
  const limits = [null, 4, 3, 2, null];
  const columns = (config['columns'] as Array<Record<string, unknown>> | undefined) ?? [];
  return {
    id: BOARD_IDS.supBoard,
    projectId: BOARD_IDS.supProject,
    originId: WORK_IDS.orgBoard,
    name: 'SUP board',
    config: {
      ...config,
      columns: columns.map((column, index) => ({ ...column, wipLimit: limits[index] ?? null })),
      lanes: { kind: 'none', queries: [], showEmpty: false, collapsible: true, totals: true },
      cardFields: ['type', 'key', 'priority', 'labels', 'assignee', 'blocked'],
      colorRule: 'priority',
      quickFilters: [{ name: 'Customer reported', query: 'label = customer' }],
    },
    createdAt: ago(60 * 24 * 60),
    updatedAt: ago(60 * 24),
  };
}

export function boardState(db: MockDb): BoardState {
  let state = states.get(db);
  if (!state) {
    state = {
      issues: [...seedPlatformIssues(), ...seedSupportIssues()],
      labels: [...seedBoardLabels(WORK_IDS.project), ...seedBoardLabels(BOARD_IDS.supProject)],
      supProject: seedSupportProject() as Row,
      supBoard: supportBoard(db),
    };
    states.set(db, state);
  }
  return state;
}

/** The issue mock's projects with Support Desk after them. */
export function projectsOf(db: MockDb): Row[] {
  const listed = issueMockProjects(db);
  const projects = listed.length > 0 ? listed : [workState(db).project];
  return [...projects, boardState(db).supProject];
}

/** A project by its id or its key, as the server's `/projects/:key/...` routes take either. */
export function projectRef(db: MockDb, ref: string | undefined): Row | undefined {
  return projectsOf(db).find((project) => project.id === ref || project['key'] === ref);
}

export function boardsOf(db: MockDb): Row[] {
  return [...workState(db).boards.filter((board) => board['projectId']), boardState(db).supBoard];
}

/** Both projects use the PLT workflow; the settings stream edits it. */
export function workflowOf(db: MockDb): Row | undefined {
  return workState(db).workflows.find((workflow) => workflow.id === WORK_IDS.workflow);
}

/** The issue in the shape of the shared issueSchema. */
export function toIssue(issue: MockIssue) {
  return {
    id: issue.id,
    projectId: issue.projectId,
    number: Number(issue.key.split('-')[1]),
    key: issue.key,
    typeId: issue.typeId,
    title: issue.title,
    description: null,
    descriptionText: '',
    statusId: issue.statusId,
    priority: issue.priority,
    assigneeId: issue.assigneeId,
    reporterId: null,
    parentId: issue.parentId,
    sprintId: issue.sprintId,
    estimate: issue.estimate,
    dueAt: issue.dueAt,
    fixVersionId: null,
    componentId: null,
    customFields: issue.customFields,
    labelIds: issue.labelIds,
    rank: issue.rank,
    statusChangedAt: issue.statusChangedAt,
    resolvedAt: null,
    deletedAt: null,
    createdAt: ago(60 * 24 * 20),
    updatedAt: issue.updatedAt,
  };
}

/** The Issue page's detail for a card only the board seeds: names beside each field, no activity. */
export function toIssueDetail(db: MockDb, issue: MockIssue) {
  const type = workState(db).issueTypes.find((row) => row.id === issue.typeId);
  const status = ((workflowOf(db)?.['statuses'] as Row[] | undefined) ?? []).find(
    (row) => row.id === issue.statusId,
  );
  const user = db.users.find((row) => row.id === issue.assigneeId);
  const parent = boardState(db).issues.find((row) => row.id === issue.parentId);
  const labels = boardState(db).labels;
  const ref = (row: MockIssue) => ({
    id: row.id,
    key: row.key,
    title: row.title,
    statusId: row.statusId,
    typeId: row.typeId,
  });
  return {
    ...toIssue(issue),
    type: {
      id: issue.typeId,
      name: String(type?.['name'] ?? 'Task'),
      key: String(type?.['key'] ?? 'task'),
      level: String(type?.['level'] ?? 'standard'),
      icon: null,
    },
    status: {
      id: issue.statusId,
      name: String(status?.['name'] ?? ''),
      category: String(status?.['category'] ?? 'todo'),
      color: null,
    },
    assignee: user ? { id: user.id, name: user.name, email: user.email } : null,
    reporter: null,
    parent: parent ? ref(parent) : null,
    sprint: null,
    fixVersion: null,
    labels: issue.labelIds.flatMap((id) => {
      const label = labels.find((row) => row.id === id);
      return label ? [{ id, name: String(label['name']), color: null }] : [];
    }),
    links: [],
    subtasks: [],
    watchersCount: 0,
    watching: false,
  };
}

const digit = (rank: string, index: number) =>
  index < rank.length ? rank.charCodeAt(index) - 97 : 0;
const char = (value: number) => String.fromCharCode(97 + value);

/** A lexorank strictly between two neighbours, as the server's lexorank computes it. */
export function rankBetween(before: string | null, after: string | null): string {
  const lower = before ?? '';
  let upper = after;
  let out = '';
  for (let i = 0; ; i++) {
    const low = digit(lower, i);
    if (upper === null) {
      if (low === 25) {
        out += char(low);
        continue;
      }
      return out + char(low + Math.floor((26 - low) / 2));
    }
    const high = digit(upper, i);
    if (low === high) {
      out += char(low);
      continue;
    }
    if (high - low > 1) return out + char(low + Math.floor((high - low) / 2));
    out += char(low);
    upper = null;
  }
}
