import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import type { Issue, RankIssueBody } from '../../../../shared/issues.ts';
import { between, needsRebalance } from '../../../../shared/lexorank.ts';
import { recordHistory } from '../history/index.ts';
import { WORK_RANK_REBALANCE_JOB } from '../jobs.ts';
import { actorUserId, projectResource, requireDatabase, type IssueServiceDeps } from './deps.ts';
import { publishIssueChange } from './notify.ts';
import { loadIssueById, loadIssueByKey, toIssue } from './rows.ts';

/*
 * Soft delete, restore and ranking. A deleted issue keeps its row and key
 * for the recovery window the capability promises; housekeeping purges it
 * after thirty days. A drop writes one rank, between its two neighbours.
 */

export const RECOVERY_DAYS = 30;

export async function deleteIssue(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  key: string,
): Promise<void> {
  const sql = requireDatabase(deps);
  const row = await loadIssueByKey(sql, key);
  await ctx.authz.authorize(ctx.actor, 'work.issue.delete', projectResource(row.project_id));
  await sql.begin(async (tx) => {
    await tx`update issues set deleted_at = now(), updated_at = now() where id = ${row.id}`;
    await recordHistory(tx, row.id, actorUserId(ctx), [{ field: 'deleted', from: null, to: true }]);
    await publishIssueChange(deps, tx, toIssue(row), { board: true });
  });
}

export async function restoreIssue(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  key: string,
): Promise<Issue> {
  const sql = requireDatabase(deps);
  const row = await loadIssueByKey(sql, key, { includeDeleted: true });
  await ctx.authz.authorize(ctx.actor, 'work.issue.delete', projectResource(row.project_id));
  if (!row.deleted_at) throw new ValidationError(`Issue ${key} is not deleted`);
  const deletedAt = new Date(row.deleted_at).getTime();
  if (Date.now() - deletedAt > RECOVERY_DAYS * 24 * 60 * 60 * 1000) {
    throw new NotFoundError(`Issue ${key} is past its ${RECOVERY_DAYS}-day recovery window`);
  }
  const restored = await sql.begin(async (tx) => {
    await tx`update issues set deleted_at = null, updated_at = now() where id = ${row.id}`;
    await recordHistory(tx, row.id, actorUserId(ctx), [{ field: 'deleted', from: true, to: null }]);
    const issue = toIssue(await loadIssueById(tx, row.id));
    await publishIssueChange(deps, tx, issue, { board: true });
    return issue;
  });
  return restored as Issue;
}

async function neighbourRank(
  tx: SqlExecutor,
  projectId: string,
  id: string | null | undefined,
): Promise<string | null> {
  if (!id) return null;
  const [row] = await tx<{ rank: string }[]>`
    select rank from issues where id = ${id} and project_id = ${projectId} and deleted_at is null`;
  if (!row) throw new ValidationError('A neighbour is not an issue of this project');
  return row.rank;
}

/**
 * Drops the issue between `beforeIssueId` (the one above it) and
 * `afterIssueId` (the one below it); either may be absent at a list's edge.
 * Long ranks enqueue the project's rebalance so the next drops stay short.
 */
export async function rankIssue(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  key: string,
  body: RankIssueBody,
): Promise<Issue> {
  const sql = requireDatabase(deps);
  const found = await loadIssueByKey(sql, key);
  await ctx.authz.authorize(ctx.actor, 'work.issue.edit', projectResource(found.project_id));
  const ranked = await sql.begin(async (tx) => {
    const row = await loadIssueByKey(tx, key, { lock: true });
    const [upper, lower] = await Promise.all([
      neighbourRank(tx, row.project_id, body.beforeIssueId),
      neighbourRank(tx, row.project_id, body.afterIssueId),
    ]);
    const rank = between(upper, lower);
    const sprintId = body.sprintId === undefined ? row.sprint_id : body.sprintId;
    await tx`
      update issues set rank = ${rank}, sprint_id = ${sprintId}, updated_at = now()
      where id = ${row.id}`;
    if (sprintId !== row.sprint_id) {
      await recordHistory(tx, row.id, actorUserId(ctx), [
        { field: 'sprintId', from: row.sprint_id, to: sprintId },
      ]);
    }
    const issue = toIssue(await loadIssueById(tx, row.id));
    await publishIssueChange(deps, tx, issue, {
      board: true,
      sprintIds: [row.sprint_id, sprintId],
    });
    if (needsRebalance([rank]) && deps.jobs) {
      await deps.jobs.send(
        WORK_RANK_REBALANCE_JOB,
        { projectId: row.project_id },
        { idempotencyKey: `rebalance:${row.project_id}` },
      );
    }
    return issue;
  });
  return ranked as Issue;
}
