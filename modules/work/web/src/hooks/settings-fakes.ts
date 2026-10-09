import type { Board, BoardConfig, Project, Workflow } from '@bemmoly/module-work/shared';
import { boardConfig, COUNTS, STATUSES } from '../settings/model/fixtures.ts';

/*
 * An in-memory Work API for the settings hook tests: one project with a board
 * copied from the org default, whose statuses carry other ids, as a real
 * project's copy does.
 */

const stamp = '2026-10-01T00:00:00.000Z';
export const PROJECT_ID = '00000000-0000-7000-8000-0000000000a1';
const BOARD_ID = '00000000-0000-7000-8000-0000000000b1';
const ORG_BOARD_ID = '00000000-0000-7000-8000-0000000000b2';
const orgStatusId = (index: number) =>
  `00000000-0000-7000-8000-0000000001${String(index).padStart(2, '0')}`;

function workflow(id: string, projectId: string | null, ids: (index: number) => string): Workflow {
  return {
    id,
    projectId,
    originId: null,
    name: 'Software workflow',
    publishedVersion: 1,
    hasDraft: false,
    statuses: STATUSES.map((status, index) => ({
      ...status,
      id: ids(index),
      workflowId: id,
      position: index,
      allowedRoleIds: [],
    })),
    transitions: [],
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function createFakeWork(method: Project['method'] = 'scrum') {
  const project: Project = {
    id: PROJECT_ID,
    key: 'PLT',
    name: 'Platform Core',
    description: null,
    teamId: null,
    method,
    schemeOverrides: { board: true },
    defaultSpaceId: null,
    archivedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const projectConfig = boardConfig();
  const orgConfig: BoardConfig = {
    ...projectConfig,
    columns: projectConfig.columns.map((column) => ({
      ...column,
      wipLimit: null,
      statusIds: column.statusIds.map((id) => orgStatusId(STATUSES.findIndex((s) => s.id === id))),
    })),
  };
  const board: Board = {
    id: BOARD_ID,
    projectId: PROJECT_ID,
    originId: ORG_BOARD_ID,
    name: 'PLT board',
    config: projectConfig,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const orgBoard: Board = {
    ...board,
    id: ORG_BOARD_ID,
    projectId: null,
    originId: null,
    name: 'Software (Scrum)',
    config: orgConfig,
  };
  const writes: { board: unknown[]; project: unknown[] } = { board: [], project: [] };

  const work = {
    projects: {
      list: async () => ({ items: [project], nextCursor: null }),
      update: async (_id: string, body: Partial<Project>) => {
        writes.project.push(body);
        Object.assign(project, body);
        return project;
      },
    },
    boards: {
      list: async () => [structuredClone(board)],
      listOrg: async () => [structuredClone(orgBoard)],
      update: async (_id: string, body: { config?: BoardConfig }) => {
        writes.board.push(body);
        if (body.config) board.config = structuredClone(body.config);
        return structuredClone(board);
      },
    },
    workflows: {
      list: async () => [
        workflow('00000000-0000-7000-8000-0000000000c1', PROJECT_ID, (i) => STATUSES[i]?.id ?? ''),
      ],
      statusCounts: async () => COUNTS,
    },
    orgWorkflows: {
      list: async () => [workflow('00000000-0000-7000-8000-0000000000c2', null, orgStatusId)],
    },
    fields: { list: async () => [] },
  };
  return { work, writes, board, project };
}
