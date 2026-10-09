import type { MockDb } from '../db.ts';
import { ago } from '../seed/time.ts';
import {
  BOARD_IDS,
  seedBoardLabels,
  seedBoardSprints,
  type MockIssue,
} from '../seed/work-board.ts';
import { seedPlatformIssues } from '../seed/work-board-plt.ts';
import { seedSupportIssues, seedSupportProject } from '../seed/work-board-sup.ts';
import { WORK_IDS } from '../seed/work-settings.ts';
import { workState, type Row } from './work-state.ts';

/*
 * The Board's rows beside the Work settings rows: issues, sprints, labels and the Support Desk
 * project with its board. Kept per mock database like work-state, so a scenario reset starts
 * them over. Projects, boards and the workflow are the settings stream's rows where they exist.
 */

export interface BoardState {
  issues: MockIssue[];
  sprints: Row[];
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
      sprints: seedBoardSprints() as Row[],
      labels: [...seedBoardLabels(WORK_IDS.project), ...seedBoardLabels(BOARD_IDS.supProject)],
      supProject: seedSupportProject() as Row,
      supBoard: supportBoard(db),
    };
    states.set(db, state);
  }
  return state;
}

export function projectsOf(db: MockDb): Row[] {
  return [workState(db).project, boardState(db).supProject];
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
