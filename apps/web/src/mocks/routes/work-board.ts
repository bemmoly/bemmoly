import { emit, type MockDb } from '../db.ts';
import type { MockIssue } from '../seed/work-board.ts';
import { bodyOf, fail, notFound, ok, type MockRoute } from '../types.ts';
import { boardMetrics, boardView } from './work-board-view.ts';
import {
  boardsOf,
  boardState,
  projectRef,
  projectsOf,
  rankBetween,
  toIssue,
  workflowOf,
} from './work-board-state.ts';
import { workState, type Row } from './work-state.ts';

/*
 * The Board's routes in the mock backend, matching the server's paths and methods: the
 * projects and boards the screen opens, the view and metrics, sprints, labels, the workflow,
 * an issue's transitions, a status change through the workflow and a rank change.
 */

const W = '/api/v1/work';

type Rule = { name: string; args: Record<string, unknown> };
type Transition = Row & { fromStatusId: string | null; toStatusId: string; name: string };

/** Why a transition is closed for an issue: the mock reads the PR and reviewer custom fields. */
function blockers(transition: Transition, issue: MockIssue): string[] {
  const rules = transition['rules'] as { conditions: Rule[]; validators: Rule[] } | undefined;
  const reasons: string[] = [];
  for (const rule of rules?.conditions ?? []) {
    if (rule.name === 'pr_linked' && !issue.customFields['pr'])
      reasons.push('Link a pull request before moving this issue to review.');
  }
  for (const rule of rules?.validators ?? []) {
    const field = String(rule.args['field'] ?? '');
    if (rule.name === 'field_not_empty' && !issue.customFields[field])
      reasons.push(`Set ${field} before moving this issue.`);
  }
  return reasons;
}

function graph(db: MockDb, issue: MockIssue) {
  const workflow = workflowOf(db);
  const statuses = (workflow?.['statuses'] as Row[] | undefined) ?? [];
  const transitions = ((workflow?.['transitions'] as Transition[] | undefined) ?? []).filter(
    (t) => t.fromStatusId === issue.statusId || t.fromStatusId === null,
  );
  return { statuses, transitions };
}

const issueByKey = (db: MockDb, key: string | undefined) =>
  boardState(db).issues.find((issue) => issue.key === key?.toUpperCase());

const boardById = (db: MockDb, id: string | undefined) =>
  boardsOf(db).find((board) => board.id === id);

function changed(db: MockDb, issue: MockIssue) {
  issue.updatedAt = new Date().toISOString();
  emit(db, 'work.board', [issue.id]);
  emit(db, 'work.issue', [issue.id]);
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
      return ok({ items: boardState(db).labels.filter((l) => l['projectId'] === project.id) });
    },
  },
  {
    method: 'GET',
    pattern: `${W}/projects/:projectId/sprints`,
    handle: (request, db) => {
      const project = projectRef(db, request.params['projectId']);
      if (!project) return notFound('Project');
      const state = request.query.get('state');
      const items = boardState(db).sprints.filter(
        (sprint) => sprint['projectId'] === project.id && (!state || sprint['state'] === state),
      );
      return ok({ items });
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
  {
    method: 'GET',
    pattern: `${W}/issues/:key/transitions`,
    handle: (request, db) => {
      const issue = issueByKey(db, request.params['key']);
      if (!issue) return notFound('Issue');
      const { statuses, transitions } = graph(db, issue);
      const items = transitions.flatMap((transition) => {
        const to = statuses.find((status) => status.id === transition.toStatusId);
        if (!to || to.id === issue.statusId) return [];
        const reasons = blockers(transition, issue);
        return [
          {
            id: transition.id,
            name: transition.name,
            toStatusId: to.id,
            toStatusName: to['name'],
            toStatusCategory: to['category'],
            available: reasons.length === 0,
            blockedBy: reasons,
          },
        ];
      });
      return ok({ items });
    },
  },
  {
    method: 'PATCH',
    pattern: `${W}/issues/:key`,
    handle: (request, db) => {
      const issue = issueByKey(db, request.params['key']);
      if (!issue) return notFound('Issue');
      const { statusId } = bodyOf<{ statusId: string }>(request);
      if (statusId && statusId !== issue.statusId) {
        const { statuses, transitions } = graph(db, issue);
        const to = statuses.find((status) => status.id === statusId);
        if (!to) return notFound('The target status');
        const transition = transitions.find((t) => t.toStatusId === statusId);
        if (!transition)
          return fail(400, 'bad_request', `No transition leads from this status to ${to['name']}`);
        const reasons = blockers(transition, issue);
        if (reasons.length > 0)
          return fail(400, 'validation_failed', 'The transition is blocked', { reasons });
        issue.statusId = statusId;
        issue.statusChangedAt = new Date().toISOString();
      }
      changed(db, issue);
      return ok(toIssue(issue));
    },
  },
  {
    method: 'PATCH',
    pattern: `${W}/issues/:key/rank`,
    handle: (request, db) => {
      const issue = issueByKey(db, request.params['key']);
      if (!issue) return notFound('Issue');
      const body = bodyOf<{ beforeIssueId: string | null; afterIssueId: string | null }>(request);
      const { issues } = boardState(db);
      const before = issues.find((other) => other.id === body.beforeIssueId)?.rank ?? null;
      const after = issues.find((other) => other.id === body.afterIssueId)?.rank ?? null;
      if (before !== null && after !== null && before >= after)
        return fail(409, 'conflict', 'The neighbours moved; reload the board and try again.');
      issue.rank = rankBetween(before, after);
      changed(db, issue);
      return ok(toIssue(issue));
    },
  },
];
