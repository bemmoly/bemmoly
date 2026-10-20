import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import { DOMAIN_EVENT_KINDS } from '@bemmoly/shared/webhooks';
import {
  createIssueBodySchema,
  type CreateIssueBody,
  type Issue,
} from '../../../../shared/issues.ts';
import { last } from '../../../../shared/lexorank.ts';
import { richTextToPlain } from '../../../../shared/rich-text.ts';
import { recordHistory } from '../history/index.ts';
import { actorUserId, projectResource, requireDatabase, type IssueServiceDeps } from './deps.ts';
import { authorizeEpics } from './epics.ts';
import { publishIssueEvent } from './events.ts';
import { loadFieldDefinitions, requiredFields, validateCustomFields } from './fields.ts';
import { notify, notifyDescriptionMentions, publishIssueChange } from './notify.ts';
import { assertOwnReferences } from './references.ts';
import { loadIssueById, toIssue } from './rows.ts';

/**
 * The next number of a project, in one statement: the upsert bumps the counter row and
 * returns the number it held, so a project created before the counter existed still numbers
 * from 1. The row stays locked until the transaction ends, so two creates in flight get
 * consecutive numbers and a rolled back create gives its number back: keys stay gap-free.
 * Callers take it as late as they can, right before the insert that uses it, because every
 * other create in the project waits on that lock until this transaction commits.
 */
export async function allocateNumber(tx: SqlExecutor, projectId: string): Promise<number> {
  const [row] = await tx<{ number: number }[]>`
    insert into project_counters (project_id, next_number) values (${projectId}, 2)
    on conflict (project_id) do update
      set next_number = project_counters.next_number + 1, updated_at = now()
    returning next_number - 1 as number`;
  if (!row) throw new NotFoundError('The project was not found');
  return row.number;
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

/**
 * The status a create asked for, when it is one of the project's workflow (its own, or the
 * org default it inherits). Any status will do, with no transition: a create places an issue
 * where it already stands, as an import does.
 */
async function startStatus(
  tx: SqlExecutor,
  projectId: string,
  statusId: string | undefined,
): Promise<{ id: string; done: boolean }> {
  if (!statusId) return { id: await initialStatusId(tx, projectId), done: false };
  const [row] = await tx<{ category: string }[]>`
    select s.category from workflow_statuses s
    where s.id = ${statusId} and s.workflow_id = (
      select w.id from workflows w
      where w.project_id = ${projectId} or w.project_id is null
      order by w.project_id nulls last, w.id
      limit 1)`;
  if (!row) throw new ValidationError("The status is not part of the project's workflow");
  return { id: statusId, done: row.category === 'done' };
}

async function projectKeyOf(tx: SqlExecutor, projectId: string): Promise<string> {
  const [row] = await tx<{ key: string }[]>`
    select key from projects where id = ${projectId} and archived_at is null`;
  if (!row) throw new NotFoundError('The project was not found');
  return row.key;
}

/**
 * A new epic takes the next colour of the palette in its project, so two
 * epics side by side never share one until the palette runs out.
 */
async function paintNewEpic(tx: SqlExecutor, issueId: string): Promise<void> {
  await tx`
    update issues i set color = 'epic-' || ((
      select count(*) from issues e
      join issue_types t on t.id = e.type_id and t.level = 'epic'
      where e.project_id = i.project_id and e.id <> i.id) % 8 + 1)
    where i.id = ${issueId} and i.color is null
      and exists (select 1 from issue_types t where t.id = i.type_id and t.level = 'epic')`;
}

export async function createIssue(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  input: CreateIssueBody,
): Promise<Issue> {
  const body = createIssueBodySchema.parse(input);
  await ctx.authz.authorize(ctx.actor, 'work.issue.edit', projectResource(body.projectId));
  // Starting anywhere but the first status skips the workflow's transition rules, so only
  // someone who configures the project may do it (an import, a migration).
  if (body.statusId) {
    await ctx.authz.authorize(ctx.actor, 'work.project.configure', projectResource(body.projectId));
  }
  const sql = requireDatabase(deps);
  await authorizeEpics(ctx, sql, projectResource(body.projectId), [body.typeId]);
  const actorId = actorUserId(ctx);
  const created = await sql.begin(async (tx) => {
    const [projectKey, status] = await Promise.all([
      projectKeyOf(tx, body.projectId),
      startStatus(tx, body.projectId, body.statusId),
      assertOwnReferences(tx, body.projectId, body),
    ]);
    const definitions = await loadFieldDefinitions(tx, body.projectId);
    const customFields = validateCustomFields(definitions, body.customFields ?? {});
    const missing = (await requiredFields(tx, body.typeId)).filter(
      ({ key }) => customFields[key] === undefined || customFields[key] === null,
    );
    if (missing.length > 0) {
      // Named in the message itself: an API or MCP client often shows only the message.
      const names = missing.map((field) => `${field.name} (${field.key})`).join(', ');
      throw new ValidationError(`Required fields are missing: ${names}`, {
        details: { fields: missing.map((field) => field.key) },
      });
    }
    if (body.startAt && body.dueAt && body.startAt > body.dueAt) {
      throw new ValidationError('An issue starts on or before its due date', {
        details: { path: 'startAt' },
      });
    }
    // The counter lock serialises creates in a project, so the tail is read
    // under it: read before, two creates in flight would append the same rank.
    // Live issues only, so the read is an index-only lookup on issues_board_rank_idx;
    // a deleted issue that ranks later gets a fresh tail rank when it is restored.
    const number = await allocateNumber(tx, body.projectId);
    const [tail] = await tx<{ rank: string | null }[]>`
      select max(rank) as rank from issues
      where project_id = ${body.projectId} and deleted_at is null`;
    const description = body.description ?? null;
    const [row] = await tx<{ id: string }[]>`
      insert into issues (project_id, number, key, type_id, title, description, description_text,
        status_id, priority, assignee_id, reporter_id, parent_id, sprint_id, estimate, start_at,
        due_at, fix_version_id, component_id, custom_fields, rank, resolved_at)
      values (${body.projectId}, ${number}, ${`${projectKey}-${number}`}, ${body.typeId},
        ${body.title}, ${description ? JSON.stringify(description) : null}::jsonb,
        ${richTextToPlain(description)}, ${status.id}, ${body.priority},
        ${body.assigneeId ?? null}, ${actorId}, ${body.parentId ?? null},
        ${body.sprintId ?? null}, ${body.estimate ?? null}, ${body.startAt ?? null},
        ${body.dueAt ?? null},
        ${body.fixVersionId ?? null}, ${body.componentId ?? null},
        ${JSON.stringify(customFields)}::jsonb, ${last(tail?.rank ?? undefined)},
        case when ${status.done} then now() end)
      returning id`;
    if (!row) throw new NotFoundError('The issue was not stored');
    await paintNewEpic(tx, row.id);
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
    await notifyDescriptionMentions(deps, ctx, tx, issue, null);
    await publishIssueEvent(deps, ctx, tx, DOMAIN_EVENT_KINDS.issueCreated, issue);
    return issue;
  });
  return created as Issue;
}
