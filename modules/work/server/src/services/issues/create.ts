import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import {
  createIssueBodySchema,
  type CreateIssueBody,
  type Issue,
} from '../../../../shared/issues.ts';
import { last } from '../../../../shared/lexorank.ts';
import { richTextToPlain } from '../../../../shared/rich-text.ts';
import { recordHistory } from '../history/index.ts';
import { actorUserId, projectResource, requireDatabase, type IssueServiceDeps } from './deps.ts';
import { loadFieldDefinitions, requiredFieldKeys, validateCustomFields } from './fields.ts';
import { notify, publishIssueChange } from './notify.ts';
import { loadIssueById, toIssue } from './rows.ts';

/**
 * The next number of a project, allocated under the counter row's lock so
 * two creates in flight get consecutive numbers and a rolled back create
 * still leaves no gap worth noticing. The counter row is made on first use
 * so a project created before the counter existed still numbers from 1.
 */
export async function allocateNumber(tx: SqlExecutor, projectId: string): Promise<number> {
  await tx`
    insert into project_counters (project_id) values (${projectId})
    on conflict (project_id) do nothing`;
  const [row] = await tx<{ next_number: number }[]>`
    select next_number from project_counters where project_id = ${projectId} for update`;
  if (!row) throw new NotFoundError('The project was not found');
  await tx`
    update project_counters set next_number = next_number + 1, updated_at = now()
    where project_id = ${projectId}`;
  return row.next_number;
}

/**
 * Where a new issue starts: the first todo status of the project's workflow,
 * or of the org default when the project has none. Read generically so a
 * renamed "To do" still works.
 */
export async function initialStatusId(tx: SqlExecutor, projectId: string): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    select s.id from workflow_statuses s
    join workflows w on w.id = s.workflow_id
    where (w.project_id = ${projectId} or w.project_id is null) and s.category = 'todo'
    order by w.project_id nulls last, w.id, s.position, s.id
    limit 1`;
  if (!row) throw new ValidationError('The project has no workflow with a todo status');
  return row.id;
}

async function projectKeyOf(tx: SqlExecutor, projectId: string): Promise<string> {
  const [row] = await tx<{ key: string }[]>`
    select key from projects where id = ${projectId} and archived_at is null`;
  if (!row) throw new NotFoundError('The project was not found');
  return row.key;
}

async function assertTypeInProject(tx: SqlExecutor, projectId: string, typeId: string) {
  const [row] = await tx<{ id: string }[]>`
    select id from issue_types
    where id = ${typeId} and (project_id = ${projectId} or project_id is null)`;
  if (!row) throw new ValidationError('The issue type does not belong to this project');
}

export async function createIssue(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  input: CreateIssueBody,
): Promise<Issue> {
  const body = createIssueBodySchema.parse(input);
  await ctx.authz.authorize(ctx.actor, 'work.issue.edit', projectResource(body.projectId));
  const sql = requireDatabase(deps);
  const actorId = actorUserId(ctx);
  const created = await sql.begin(async (tx) => {
    const [projectKey, statusId] = await Promise.all([
      projectKeyOf(tx, body.projectId),
      initialStatusId(tx, body.projectId),
      assertTypeInProject(tx, body.projectId, body.typeId),
    ]);
    const definitions = await loadFieldDefinitions(tx, body.projectId);
    const customFields = validateCustomFields(definitions, body.customFields ?? {});
    const missing = (await requiredFieldKeys(tx, body.typeId)).filter(
      (key) => customFields[key] === undefined || customFields[key] === null,
    );
    if (missing.length > 0) {
      throw new ValidationError('Required fields are missing', { details: { fields: missing } });
    }
    const [tail] = await tx<{ rank: string | null }[]>`
      select max(rank) as rank from issues where project_id = ${body.projectId}`;
    const number = await allocateNumber(tx, body.projectId);
    const description = body.description ?? null;
    const [row] = await tx<{ id: string }[]>`
      insert into issues (project_id, number, key, type_id, title, description, description_text,
        status_id, priority, assignee_id, reporter_id, parent_id, sprint_id, estimate, due_at,
        fix_version_id, component_id, custom_fields, rank)
      values (${body.projectId}, ${number}, ${`${projectKey}-${number}`}, ${body.typeId},
        ${body.title}, ${description ? JSON.stringify(description) : null}::jsonb,
        ${richTextToPlain(description)}, ${statusId}, ${body.priority},
        ${body.assigneeId ?? null}, ${actorId}, ${body.parentId ?? null},
        ${body.sprintId ?? null}, ${body.estimate ?? null}, ${body.dueAt ?? null},
        ${body.fixVersionId ?? null}, ${body.componentId ?? null},
        ${JSON.stringify(customFields)}::jsonb, ${last(tail?.rank ?? undefined)})
      returning id`;
    if (!row) throw new NotFoundError('The issue was not stored');
    for (const labelId of body.labelIds ?? []) {
      await tx`insert into issue_labels (issue_id, label_id) values (${row.id}, ${labelId})`;
    }
    if (actorId) {
      await tx`
        insert into watchers (target_kind, target_id, user_id) values ('issue', ${row.id}, ${actorId})
        on conflict do nothing`;
    }
    const issue = toIssue(await loadIssueById(tx, row.id));
    await recordHistory(tx, issue.id, actorId, [{ field: 'created', from: null, to: issue.key }]);
    await publishIssueChange(deps, tx, issue, { board: true });
    if (issue.assigneeId) {
      await notify(deps, ctx, tx, issue, {
        kind: 'assignment',
        recipientIds: [issue.assigneeId],
        body: issue.title,
        dedupeKey: `issue:${issue.id}:assigned:${issue.assigneeId}:created`,
      });
    }
    return issue;
  });
  return created as Issue;
}
