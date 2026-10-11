import type {
  AuditRecorder,
  CodeActivityConsumer,
  RealtimePublisher,
  RequestContext,
  SqlClient,
} from '@bemmoly/core';
import { BemmolyError, ProviderError, type CodeHostKind } from '@bemmoly/shared';
import type {
  CodeLink,
  CodeTransitions,
  UpdateCodeTransitionsBody,
} from '../../../../shared/code-links.ts';
import { WORK_REALTIME_KINDS } from '../../../../shared/realtime.ts';
import { iso, projectResource } from '../issues/deps.ts';
import { loadIssueByKey } from '../issues/rows.ts';
import { applyActivity, type StateChange, type TouchedIssue } from './apply.ts';
import {
  getCodeTransitions,
  transitionTarget,
  triggerOf,
  updateCodeTransitions,
} from './transitions.ts';

export { findIssueKeys } from '../../../../shared/code-links.ts';
export { triggerOf } from './transitions.ts';

export interface CodeLinksDeps {
  database?: SqlClient;
  realtime: RealtimePublisher;
  audit?: AuditRecorder;
  /** Moves an issue as the issues service does, workflow gate and history included. */
  move: (ctx: RequestContext, key: string, statusId: string) => Promise<unknown>;
}

interface CodeLinkRow {
  id: string;
  kind: CodeLink['kind'];
  host_kind: CodeHostKind;
  repository: string;
  ref: string;
  title: string;
  url: string;
  state: CodeLink['state'];
  checks: CodeLink['checks'];
  review: CodeLink['review'];
  author: string | null;
  source_updated_at: Date | string;
}

/** Pull requests first, then branches, then commits; newest first within each. */
const LIST_LIMIT = 50;

const toCodeLink = (row: CodeLinkRow): CodeLink => ({
  id: row.id,
  kind: row.kind,
  hostKind: row.host_kind,
  repository: row.repository,
  ref: row.ref,
  title: row.title,
  url: row.url,
  state: row.state,
  checks: row.checks,
  review: row.review,
  author: row.author,
  updatedAt: iso(row.source_updated_at),
});

const STATE_WORDS: Record<string, string> = { open: 'opened', merged: 'merged' };

/**
 * Pull requests, branches and commits linked to issues by key: the Development section's
 * list, the project's optional moves, and the consumer the kernel hands verified code host
 * activity to.
 */
export function createCodeLinksService(deps: CodeLinksDeps) {
  const database = (): SqlClient => {
    if (!deps.database) throw new ProviderError('The work module needs the database');
    return deps.database;
  };

  /** A move the workflow refuses is reported in the delivery log, never retried. */
  async function moveFor(change: StateChange, ctx: RequestContext): Promise<string | null> {
    const trigger = triggerOf(change.from, change.to);
    if (!trigger) return null;
    const statusId = await transitionTarget(database(), change.issue.projectId, trigger);
    if (!statusId || statusId === change.issue.statusId) return null;
    try {
      await deps.move(ctx, change.issue.key, statusId);
      return null;
    } catch (error) {
      if (!(error instanceof BemmolyError) || error instanceof ProviderError) throw error;
      const when = STATE_WORDS[change.to ?? ''] ?? 'changed';
      return `${change.issue.key} stayed put when its pull request ${when}: ${error.message}`;
    }
  }

  async function publish(issues: Iterable<TouchedIssue>): Promise<void> {
    for (const issue of issues) {
      await deps.realtime.publish({
        kind: WORK_REALTIME_KINDS.issue,
        ids: [issue.id],
        projectId: issue.projectId,
      });
    }
  }

  const consumer: CodeActivityConsumer = {
    id: 'work.code-links',
    async apply(activities, ctx) {
      const sql = database();
      const touched = new Map<string, TouchedIssue>();
      const changes: StateChange[] = [];
      let linked = 0;
      for (const activity of activities) {
        const outcome = await applyActivity(sql, activity);
        linked += outcome.touched.length;
        for (const issue of outcome.touched) touched.set(issue.id, issue);
        changes.push(...outcome.changes);
      }
      await publish(touched.values());
      const notes: string[] = [];
      for (const change of changes) {
        const note = await moveFor(change, ctx);
        if (note) notes.push(note);
      }
      return { linked, notes };
    },
  };

  return {
    consumer,

    async list(ctx: RequestContext, key: string): Promise<CodeLink[]> {
      const sql = database();
      const issue = await loadIssueByKey(sql, key);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(issue.project_id));
      const rows = await sql<CodeLinkRow[]>`
        select l.id, l.kind, i.kind as host_kind, l.repository, l.ref, l.title, l.url, l.state,
          l.checks, l.review, l.author, l.source_updated_at
        from code_links l join integrations i on i.id = l.integration_id
        where l.issue_id = ${issue.id}
        order by case l.kind when 'pull_request' then 0 when 'branch' then 1 else 2 end,
          l.source_updated_at desc, l.id desc
        limit ${LIST_LIMIT}`;
      return rows.map(toCodeLink);
    },

    transitions: (ctx: RequestContext, projectKey: string): Promise<CodeTransitions> =>
      getCodeTransitions(database(), ctx, projectKey),

    updateTransitions: (
      ctx: RequestContext,
      projectKey: string,
      body: UpdateCodeTransitionsBody,
    ): Promise<CodeTransitions> =>
      updateCodeTransitions(database(), deps.audit, ctx, projectKey, body),
  };
}

export type CodeLinksService = ReturnType<typeof createCodeLinksService>;
