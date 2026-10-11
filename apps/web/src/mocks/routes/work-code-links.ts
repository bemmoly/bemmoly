import { can } from '../db.ts';
import type { CodeTransitions } from '../seed/code-hosts.ts';
import { fail, ok, type MockRoute } from '../types.ts';
import { codeHostsOf } from './code-hosts.ts';

const NONE: CodeTransitions = { pullRequestOpened: null, pullRequestMerged: null };

/** An issue's Development section and a project's moves on linked pull requests. */
export const workCodeLinkRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/work/issues/:key/code-links',
    handle: (request, db) => {
      const key = (request.params['key'] ?? '').toUpperCase();
      return ok({ items: codeHostsOf(db).links[key] ?? [] });
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/work/projects/:key/code-transitions',
    handle: (request, db) => {
      const key = (request.params['key'] ?? '').toUpperCase();
      return ok(codeHostsOf(db).transitions[key] ?? NONE);
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/work/projects/:key/code-transitions',
    handle: (request, db) => {
      if (!can(db, 'work.project.configure')) {
        return fail(403, 'forbidden', 'You need "Configure project" to change this.');
      }
      const key = (request.params['key'] ?? '').toUpperCase();
      const state = codeHostsOf(db);
      const body = (request.body ?? {}) as Partial<CodeTransitions>;
      const next = { ...(state.transitions[key] ?? NONE) };
      if (body.pullRequestOpened !== undefined) next.pullRequestOpened = body.pullRequestOpened;
      if (body.pullRequestMerged !== undefined) next.pullRequestMerged = body.pullRequestMerged;
      state.transitions[key] = next;
      return ok(next);
    },
  },
];
