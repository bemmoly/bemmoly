import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type {
  ChangeEnvironmentRow,
  ChangeRequestDecisionRow,
  ChangeRequestEventRow,
  ChangeRequestItemRow,
  ChangeRequestPickRow,
  ChangeRequestRow,
  ChangeRequestStepRow,
} from '../../models/change-requests.ts';

/* The reads every change request service starts from, one query each. */

const REQUEST_COLUMNS = `c.id, c.number::text as number, c.environment_id,
  e.key as environment_key, e.name as environment_name, c.title, c.why, c.risk, c.deploy_at,
  c.rollback, c.status, c.requested_by, u.name as requester_name, c.emergency_reason,
  c.sent_at, c.decided_at, c.created_at, c.updated_at`;

/** "CHG-1042" to 1042. */
export const numberOf = (name: string): string => name.replace(/^CHG-/, '');

export async function loadRequest(
  sql: SqlExecutor,
  by: { number: string } | { id: string },
  lock = false,
): Promise<ChangeRequestRow> {
  const id = 'id' in by ? by.id : null;
  const number = 'number' in by ? numberOf(by.number) : null;
  const [row] = await sql<ChangeRequestRow[]>`
    select ${sql.unsafe(REQUEST_COLUMNS)}
    from pipeline_change_requests c
    join pipeline_environments e on e.id = c.environment_id
    left join users u on u.id = c.requested_by
    where (${id}::uuid is not null and c.id = ${id}::uuid)
      or (${number}::bigint is not null and c.number = ${number}::bigint)
    ${lock ? sql`for update of c` : sql``}`;
  if (!row) throw new NotFoundError('That change request does not exist');
  return row;
}

export async function loadEnvironment(
  sql: SqlExecutor,
  by: { key: string } | { id: string },
): Promise<ChangeEnvironmentRow> {
  const id = 'id' in by ? by.id : null;
  const key = 'key' in by ? by.key : null;
  const [row] = await sql<ChangeEnvironmentRow[]>`
    select id, key, name, position, approval_rule, deploy_window, versions_allowed, deployers
    from pipeline_environments
    where archived_at is null
      and ((${id}::uuid is not null and id = ${id}::uuid)
        or (${key}::text is not null and key = ${key}::text))`;
  if (!row) throw new NotFoundError(`There is no environment called ${key ?? 'that'}`);
  return row;
}

/** The environment just before this one on the promotion path, if any. */
export async function previousEnvironment(
  sql: SqlExecutor,
  environment: ChangeEnvironmentRow,
): Promise<{ id: string; key: string; name: string } | null> {
  const [row] = await sql<{ id: string; key: string; name: string }[]>`
    select id, key, name from pipeline_environments
    where archived_at is null and position < ${environment.position}
    order by position desc, id desc limit 1`;
  return row ?? null;
}

export async function loadItems(
  sql: SqlExecutor,
  requestId: string,
): Promise<ChangeRequestItemRow[]> {
  return sql<ChangeRequestItemRow[]>`
    select i.id, i.application_id, a.key as application_key, a.name as application_name,
      i.release_id, r.version, r.run_id, i.from_release_id, fr.version as from_version,
      i.promotion_id, p.state as promotion_state
    from pipeline_change_request_items i
    join pipeline_applications a on a.id = i.application_id
    join pipeline_releases r on r.id = i.release_id
    left join pipeline_releases fr on fr.id = i.from_release_id
    left join pipeline_promotions p on p.id = i.promotion_id
    where i.change_request_id = ${requestId}
    order by a.key`;
}

export async function loadSteps(
  sql: SqlExecutor,
  requestId: string,
): Promise<ChangeRequestStepRow[]> {
  return sql<ChangeRequestStepRow[]>`
    select id, position, group_id, group_name, count, condition, state
    from pipeline_change_request_steps
    where change_request_id = ${requestId} order by position`;
}

export async function loadPicks(
  sql: SqlExecutor,
  requestId: string,
): Promise<ChangeRequestPickRow[]> {
  return sql<ChangeRequestPickRow[]>`
    select p.step_id, p.user_id, u.name
    from pipeline_change_request_picks p
    join pipeline_change_request_steps s on s.id = p.step_id
    join users u on u.id = p.user_id
    where s.change_request_id = ${requestId}
    order by u.name`;
}

export async function loadDecisions(
  sql: SqlExecutor,
  requestId: string,
): Promise<ChangeRequestDecisionRow[]> {
  return sql<ChangeRequestDecisionRow[]>`
    select a.step_id, a.user_id, u.name, a.decision, a.note, a.created_at
    from pipeline_change_request_approvals a
    join pipeline_change_request_steps s on s.id = a.step_id
    left join users u on u.id = a.user_id
    where s.change_request_id = ${requestId}
    order by a.created_at, a.id`;
}

export async function loadEvents(
  sql: SqlExecutor,
  requestId: string,
): Promise<ChangeRequestEventRow[]> {
  return sql<ChangeRequestEventRow[]>`
    select ev.user_id, u.name, ev.kind, ev.data, ev.created_at
    from pipeline_change_request_events ev
    left join users u on u.id = ev.user_id
    where ev.change_request_id = ${requestId}
    order by ev.created_at desc, ev.id desc`;
}

/** Group names by id, for steps and rule previews. */
export async function groupNames(
  sql: SqlExecutor,
  ids: readonly string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await sql<{ id: string; name: string }[]>`
    select id, name from pipeline_approval_groups where id = any(${ids as string[]}::uuid[])`;
  return new Map(rows.map((row) => [row.id, row.name]));
}

/** The members of a group, by name. */
export async function groupMembers(
  sql: SqlExecutor,
  groupId: string,
): Promise<Array<{ id: string; name: string }>> {
  return sql<Array<{ id: string; name: string }>>`
    select u.id, u.name from pipeline_approval_group_members m
    join users u on u.id = m.user_id
    where m.group_id = ${groupId} order by u.name`;
}
