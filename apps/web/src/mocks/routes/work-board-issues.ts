import { emit, type MockDb } from '../db.ts';
import type { MockIssue } from '../seed/work-board.ts';
import { bodyOf, fail, notFound, ok, type MockRoute } from '../types.ts';
import { askIssueMock } from './work-board-delegate.ts';
import { boardState, rankBetween, toIssue, toIssueDetail, workflowOf } from './work-board-state.ts';
import type { Row } from './work-state.ts';

/*
 * The board's issue routes: transitions, a status change checked against the workflow, a rank
 * change, and the issue read for cards only the board seeds. Issues the issue mock also keeps
 * are handed to it after the board's checks, so both stores stay in step.
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

function changed(db: MockDb, issue: MockIssue) {
  issue.updatedAt = new Date().toISOString();
  emit(db, 'work.board', [issue.id]);
  emit(db, 'work.issue', [issue.id]);
}

/** Fields the slide-over edits that the board's cards also show. */
const MIRRORED = ['title', 'priority', 'assigneeId', 'estimate', 'labelIds', 'dueAt'] as const;

export const boardIssueRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${W}/issues/:key`,
    handle: (request, db) => {
      const theirs = askIssueMock('GET', '/issues/:key', request, db);
      if (theirs && theirs.status !== 404) return theirs;
      const issue = issueByKey(db, request.params['key']);
      return issue ? ok(toIssueDetail(db, issue)) : notFound('Issue');
    },
  },
  {
    method: 'GET',
    pattern: `${W}/issues/:key/transitions`,
    handle: (request, db) => {
      const issue = issueByKey(db, request.params['key']);
      if (!issue)
        return askIssueMock('GET', '/issues/:key/transitions', request, db) ?? notFound('Issue');
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
      const body = bodyOf<Record<string, unknown>>(request);
      const statusId = typeof body['statusId'] === 'string' ? body['statusId'] : undefined;
      if (issue && statusId && statusId !== issue.statusId) {
        const { statuses, transitions } = graph(db, issue);
        const to = statuses.find((status) => status.id === statusId);
        if (!to) return notFound('The target status');
        const transition = transitions.find((t) => t.toStatusId === statusId);
        if (!transition)
          return fail(400, 'bad_request', `No transition leads from this status to ${to['name']}`);
        const reasons = blockers(transition, issue);
        if (reasons.length > 0)
          return fail(400, 'validation_failed', 'The transition is blocked', { reasons });
      }
      const theirs = askIssueMock('PATCH', '/issues/:key', request, db);
      if (!issue) return theirs ?? notFound('Issue');
      if (theirs && theirs.status >= 400 && theirs.status !== 404) return theirs;
      if (statusId && statusId !== issue.statusId) {
        issue.statusId = statusId;
        issue.statusChangedAt = new Date().toISOString();
      }
      for (const field of MIRRORED) {
        if (field in body) Object.assign(issue, { [field]: body[field] });
      }
      changed(db, issue);
      return theirs && theirs.status < 300 ? theirs : ok(toIssue(issue));
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
