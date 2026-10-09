import type { MockDb } from '../db.ts';
import { fail, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import { askIssueMock } from './work-board-delegate.ts';
import { boardIssueRoutes } from './work-board-issues.ts';
import { boardMetrics, boardView } from './work-board-view.ts';
import { boardsOf, boardState, projectRef, projectsOf, workflowOf } from './work-board-state.ts';
import { workState } from './work-state.ts';

/*
 * The Board's routes in the mock backend, matching the server's paths and methods: the
 * projects and boards the screen opens, the view and metrics, labels, issue types, the
 * workflow, and (in work-board-issues.ts) an issue's transitions, status and rank. Rows the
 * issue mock keeps are read from it, so both screens see the same projects, sprints and labels.
 */

const W = '/api/v1/work';

const boardById = (db: MockDb, id: string | undefined) =>
  boardsOf(db).find((board) => board.id === id);

/** The issue mock's answer for a project route, unless it does not know the project. */
function issueMockFirst(pattern: string, request: MockRequest, db: MockDb) {
  const key = String(projectRef(db, request.params['projectId'])?.['key'] ?? '');
  const theirs = askIssueMock('GET', pattern, { ...request, params: { key } }, db);
  return theirs && theirs.status !== 404 ? theirs : null;
}

export const workBoardRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${W}/projects`,
    handle: (_, db) => ok({ items: projectsOf(db), nextCursor: null }),
  },
  {
    method: 'GET',
    pattern: `${W}/projects/:projectId/boards`,
    handle: (request, db) => {
      const project = projectRef(db, request.params['projectId']);
      if (!project) return notFound('Project');
      return ok({ items: boardsOf(db).filter((board) => board['projectId'] === project.id) });
    },
  },
  {
    method: 'GET',
    pattern: `${W}/projects/:projectId/issue-types`,
    handle: (request, db) => {
      const project = projectRef(db, request.params['projectId']);
      if (!project) return notFound('Project');
      const theirs = issueMockFirst('/projects/:key/issue-types', request, db);
      if (theirs) return theirs;
      const types = workState(db).issueTypes.filter(
        (type) => type['projectId'] === null || type['projectId'] === project.id,
      );
      return ok({ items: types });
    },
  },
  {
    method: 'GET',
    pattern: `${W}/projects/:projectId/labels`,
    handle: (request, db) => {
      const project = projectRef(db, request.params['projectId']);
      if (!project) return notFound('Project');
      const items = boardState(db).labels.filter((label) => label['projectId'] === project.id);
      return ok({ items, nextCursor: null });
    },
  },
  {
    method: 'GET',
    pattern: `${W}/workflows`,
    handle: (request, db) => {
      const project = projectRef(db, request.query.get('projectId') ?? undefined);
      const workflow = workflowOf(db);
      return ok({ items: project && workflow ? [workflow] : [] });
    },
  },
  {
    method: 'GET',
    pattern: `${W}/boards/:id/view`,
    handle: (request, db) => {
      const board = boardById(db, request.params['id']);
      if (!board) return notFound('Board');
      const result = boardView(db, board, request.query.get('q'));
      if (!result.ok) return fail(400, 'validation_failed', result.error);
      return ok(result.view);
    },
  },
  {
    method: 'GET',
    pattern: `${W}/boards/:id/metrics`,
    handle: (request, db) => {
      const board = boardById(db, request.params['id']);
      if (!board) return notFound('Board');
      const result = boardView(db, board, null);
      if (!result.ok) return notFound('Project');
      const { sprintId } = result.view;
      const scoped = boardState(db).issues.filter((issue) =>
        result.view.cards.some((card) => card.issueId === issue.id),
      );
      return ok({
        boardId: board.id,
        velocity: [],
        burndown: [],
        sprintId,
        ...boardMetrics(db, board, scoped, sprintId),
        computedAt: new Date().toISOString(),
      });
    },
  },
  ...boardIssueRoutes,
];
