import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { WorkflowRule } from '../../../../shared/index.ts';
import type { Issue, UpdateIssueBody } from '../../../../shared/issues.ts';
import { richTextToPlain } from '../../../../shared/rich-text.ts';
import { recordHistory, type HistoryChange } from '../history/index.ts';
import { actorUserId, projectResource, requireDatabase, type IssueServiceDeps } from './deps.ts';
import { loadFieldDefinitions, validateCustomFields } from './fields.ts';
import { notify, publishIssueChange, watcherIds } from './notify.ts';
import { assertOwnReferences } from './references.ts';
import { loadIssueById, loadIssueByKey, toIssue, type IssueRow } from './rows.ts';

/*
 * One PATCH, one transaction: the row is locked, every changed field is
 * written and gets a history row, a status change is first asked of the
 * workflow gate, and the people concerned are told once the commit lands.
 */

type Scalar = keyof Pick<
  UpdateIssueBody,
  | 'title'
  | 'priority'
  | 'assigneeId'
  | 'parentId'
  | 'sprintId'
  | 'estimate'
  | 'dueAt'
  | 'fixVersionId'
  | 'componentId'
  | 'typeId'
>;

const COLUMNS: Record<Scalar, string> = {
  title: 'title',
  priority: 'priority',
  assigneeId: 'assignee_id',
  parentId: 'parent_id',
  sprintId: 'sprint_id',
  estimate: 'estimate',
  dueAt: 'due_at',
  fixVersionId: 'fix_version_id',
  componentId: 'component_id',
  typeId: 'type_id',
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The field changes a body implies against the current row; nothing for a no-op PATCH. */
export function diffIssue(current: Issue, body: UpdateIssueBody): HistoryChange[] {
  const changes: HistoryChange[] = [];
  for (const field of Object.keys(COLUMNS) as Scalar[]) {
    if (body[field] !== undefined && !same(current[field], body[field])) {
      changes.push({ field, from: current[field], to: body[field] });
    }
  }
  if (body.statusId !== undefined && body.statusId !== current.statusId) {
    changes.push({ field: 'statusId', from: current.statusId, to: body.statusId });
  }
  if (body.description !== undefined && !same(current.description, body.description)) {
    changes.push({ field: 'description', from: null, to: null });
  }
  if (body.customFields !== undefined) {
    for (const [key, value] of Object.entries(body.customFields)) {
      if (!same(current.customFields[key], value)) {
        changes.push({ field: `customFields.${key}`, from: current.customFields[key], to: value });
      }
    }
  }
  if (body.labelIds !== undefined) {
    const next = [...body.labelIds].sort();
    const previous = [...current.labelIds].sort();
    if (!same(previous, next)) changes.push({ field: 'labelIds', from: previous, to: next });
  }
  return changes;
}

/** What the PATCH sets beside the status, so a validator sees a field filled in the same move. */
function submittedFields(body: UpdateIssueBody): Record<string, unknown> {
  const submitted: Record<string, unknown> = { ...body.customFields };
  for (const field of Object.keys(COLUMNS) as Scalar[]) {
    if (body[field] === undefined) continue;
    submitted[field] = body[field];
    submitted[COLUMNS[field]] = body[field];
  }
  if (body.labelIds !== undefined) submitted['labelIds'] = body.labelIds;
  return submitted;
}

async function statusCategory(tx: SqlExecutor, statusId: string, row: IssueRow): Promise<string> {
  const [status] = await tx<{ category: string }[]>`
    select s.category from workflow_statuses s
    where s.id = ${statusId} and s.workflow_id = (
      select workflow_id from workflow_statuses where id = ${row.status_id})`;
  if (!status) throw new ValidationError('The status is not part of this workflow');
  return status.category;
}

async function writeScalars(tx: SqlExecutor, row: IssueRow, body: UpdateIssueBody) {
  for (const field of Object.keys(COLUMNS) as Scalar[]) {
    const value = body[field];
    if (value === undefined) continue;
    await tx`update issues set ${tx(COLUMNS[field])} = ${value}, updated_at = now()
      where id = ${row.id}`;
  }
  if (body.description !== undefined) {
    await tx`
      update issues set description = ${body.description ? JSON.stringify(body.description) : null}::jsonb,
        description_text = ${richTextToPlain(body.description)}, updated_at = now()
      where id = ${row.id}`;
  }
  if (body.customFields !== undefined) {
    const definitions = await loadFieldDefinitions(tx, row.project_id);
    const clean = validateCustomFields(definitions, body.customFields);
    await tx`
      update issues set custom_fields = custom_fields || ${JSON.stringify(clean)}::jsonb,
        updated_at = now()
      where id = ${row.id}`;
  }
  if (body.labelIds !== undefined) {
    await tx`delete from issue_labels where issue_id = ${row.id}
      and label_id <> all(${body.labelIds}::uuid[])`;
    for (const labelId of body.labelIds) {
      await tx`insert into issue_labels (issue_id, label_id) values (${row.id}, ${labelId})
        on conflict do nothing`;
    }
  }
}

async function tellPeople(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  tx: SqlExecutor,
  issue: Issue,
  changes: readonly HistoryChange[],
  statusName: string | null,
) {
  const assigned = changes.find((change) => change.field === 'assigneeId');
  if (assigned && typeof assigned.to === 'string') {
    await notify(deps, ctx, tx, issue, {
      kind: 'assignment',
      recipientIds: [assigned.to],
      body: issue.title,
      dedupeKey: `issue:${issue.id}:assigned:${assigned.to}:${issue.updatedAt}`,
    });
  }
  if (statusName) {
    await notify(deps, ctx, tx, issue, {
      kind: 'status_change',
      recipientIds: await watcherIds(tx, issue.id),
      body: `${issue.title} → ${statusName}`,
      dedupeKey: `issue:${issue.id}:status:${issue.statusId}:${issue.statusChangedAt}`,
    });
  }
}

export async function updateIssue(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  key: string,
  body: UpdateIssueBody,
): Promise<Issue> {
  const sql = requireDatabase(deps);
  const resource = projectResource((await loadIssueByKey(sql, key)).project_id);
  await ctx.authz.authorize(ctx.actor, 'work.issue.edit', resource);
  if (body.statusId !== undefined) {
    await ctx.authz.authorize(ctx.actor, 'work.issue.transition', resource);
  }
  const actorId = actorUserId(ctx);
  let postActions: readonly WorkflowRule[] = [];
  const updated = await sql.begin(async (tx) => {
    const row = await loadIssueByKey(tx, key, { lock: true });
    const current = toIssue(row);
    const changes = diffIssue(current, body);
    if (changes.length === 0) return current;
    let statusName: string | null = null;
    if (body.statusId !== undefined && body.statusId !== current.statusId) {
      const category = await statusCategory(tx, body.statusId, row);
      // The gate authorises, runs the conditions and the validators, and hands
      // back what must run after the move. It throws a typed error when blocked.
      const move = await deps.workflow.transition(
        ctx,
        row,
        body.statusId,
        submittedFields(body),
        tx,
      );
      postActions = move.postActions;
      await tx`
        update issues set status_id = ${body.statusId}, status_changed_at = now(),
          resolved_at = case when ${category === 'done'} then now() else null end,
          updated_at = now()
        where id = ${row.id}`;
      const [status] = await tx<{ name: string }[]>`
        select name from workflow_statuses where id = ${body.statusId}`;
      statusName = status?.name ?? null;
    }
    await assertOwnReferences(tx, row.project_id, body);
    await writeScalars(tx, row, body);
    await recordHistory(tx, row.id, actorId, changes);
    const issue = toIssue(await loadIssueById(tx, row.id));
    const boardChange = changes.some((change) =>
      ['statusId', 'sprintId', 'assigneeId', 'priority', 'title', 'typeId'].includes(change.field),
    );
    await publishIssueChange(deps, tx, issue, {
      board: boardChange,
      sprintIds: [current.sprintId, issue.sprintId],
    });
    await tellPeople(deps, ctx, tx, issue, changes, statusName);
    return issue;
  });
  if (postActions.length === 0) return updated as Issue;
  // Post-actions run after the status change is committed, on the row as it now stands.
  await deps.workflow.runPostActions(ctx, await loadIssueByKey(sql, key), postActions);
  // They may have changed the assignee, sprint or resolution: answer with the row
  // as they left it, and tell the open screens, which saw only the move.
  const settled = toIssue(await loadIssueByKey(sql, key));
  await publishIssueChange(deps, sql, settled, {
    board: true,
    sprintIds: [(updated as Issue).sprintId, settled.sprintId],
  });
  return settled;
}
