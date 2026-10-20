import type { RequestContext } from '@bemmoly/core';
import type { Issue } from '../../../../shared/issues.ts';
import { recordHistory } from '../history/index.ts';
import { actorUserId, projectResource, requireDatabase, type IssueServiceDeps } from './deps.ts';
import { publishIssueChange } from './notify.ts';
import { loadIssueById, loadIssueByKey, toIssue } from './rows.ts';

/*
 * Archiving puts an issue away without losing it: it leaves the board, the backlog, lists and
 * search, keeps its key, history and place in reports, and comes back as it was. Unlike a
 * delete it never expires. Both directions are idempotent, so a rule that archives an issue
 * already put away, or a second click, changes nothing.
 */
export async function setArchived(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  key: string,
  archived: boolean,
): Promise<Issue> {
  const sql = requireDatabase(deps);
  const found = await loadIssueByKey(sql, key);
  await ctx.authz.authorize(ctx.actor, 'work.issue.edit', projectResource(found.project_id));
  const changed = await sql.begin(async (tx) => {
    const row = await loadIssueByKey(tx, key, { lock: true });
    if ((row.archived_at !== null && row.archived_at !== undefined) === archived) {
      return toIssue(row);
    }
    await tx`
      update issues set archived_at = ${archived ? sql`now()` : null}, updated_at = now()
      where id = ${row.id}`;
    await recordHistory(tx, row.id, actorUserId(ctx), [
      { field: 'archived', from: archived ? null : true, to: archived ? true : null },
    ]);
    const issue = toIssue(await loadIssueById(tx, row.id));
    await publishIssueChange(deps, tx, issue, { board: true });
    return issue;
  });
  return changed as Issue;
}
