import type { RequestContext } from '@bemmoly/core';
import type { CreateWorkLogBody } from '../../../../shared/activity.ts';
import type {
  CreateIssueBody,
  ListIssuesQuery,
  RankIssueBody,
  UpdateIssueBody,
} from '../../../../shared/issues.ts';
import { createIssue } from './create.ts';
import type { IssueServiceDeps } from './deps.ts';
import { deleteIssue, rankIssue, restoreIssue } from './lifecycle.ts';
import { addWorkLog, assignIssue, listWatchers, listWorkLogs, watchIssue } from './people.ts';
import { getIssue, listIssues } from './read.ts';
import { updateIssue } from './update.ts';

export type { IssueServiceDeps } from './deps.ts';

/** Issues as the Issue page, the board and the backlog read and write them. */
export function createIssuesService(deps: IssueServiceDeps) {
  return {
    create: (ctx: RequestContext, body: CreateIssueBody) => createIssue(deps, ctx, body),
    get: (ctx: RequestContext, key: string) => getIssue(deps, ctx, key),
    list: (ctx: RequestContext, query: ListIssuesQuery) => listIssues(deps, ctx, query),
    update: (ctx: RequestContext, key: string, body: UpdateIssueBody) =>
      updateIssue(deps, ctx, key, body),
    remove: (ctx: RequestContext, key: string) => deleteIssue(deps, ctx, key),
    restore: (ctx: RequestContext, key: string) => restoreIssue(deps, ctx, key),
    rank: (ctx: RequestContext, key: string, body: RankIssueBody) =>
      rankIssue(deps, ctx, key, body),
    assign: (ctx: RequestContext, key: string, assigneeId: string | null) =>
      assignIssue(deps, ctx, key, assigneeId),
    watchers: (ctx: RequestContext, key: string) => listWatchers(deps, ctx, key),
    watch: (ctx: RequestContext, key: string, watching: boolean) =>
      watchIssue(deps, ctx, key, watching),
    workLogs: (ctx: RequestContext, key: string) => listWorkLogs(deps, ctx, key),
    addWorkLog: (ctx: RequestContext, key: string, body: CreateWorkLogBody) =>
      addWorkLog(deps, ctx, key, body),
  };
}

export type IssuesService = ReturnType<typeof createIssuesService>;
