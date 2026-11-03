import type { SqlExecutor } from '@bemmoly/core';
import { decodeCursor, toPage } from '@bemmoly/core';
import type {
  ChangeRequestsPage,
  ChangeRequestSummary,
  ListChangeRequestsQuery,
} from '../../../../shared/change-requests.ts';
import { person } from './present.ts';

/*
 * The Changes list, newest first, one tab at a time: open (not finished), mine (I asked),
 * waiting for me (I am picked on the open step and have not decided), decided (I decided on
 * one), done (deployed, failed, rejected or withdrawn) and all. Each row carries the open
 * step's count, "1 of 2 approvals".
 */

const OPEN = ['draft', 'waiting', 'changes_requested', 'approved', 'deploying'];
const DONE = ['deployed', 'failed', 'rejected', 'withdrawn'];

interface SummaryRow {
  id: string;
  number: string;
  title: string;
  risk: ChangeRequestSummary['risk'];
  status: ChangeRequestSummary['status'];
  environment_key: string;
  environment_name: string;
  requested_by: string | null;
  requester_name: string | null;
  created_at: string;
  items: Array<{ application: string; toVersion: string }> | null;
  got: number;
  needed: number;
  waiting_for_me: boolean;
}

export async function listChangeRequests(
  sql: SqlExecutor,
  query: ListChangeRequestsQuery,
  viewer: string,
): Promise<ChangeRequestsPage> {
  const after = decodeCursor(query.cursor);
  // The open step, or else the last decided one, gives the row its count.
  const rows = await sql<SummaryRow[]>`
    with current_step as (
      select distinct on (s.change_request_id) s.change_request_id, s.id, s.count
      from pipeline_change_request_steps s
      order by s.change_request_id, (s.state = 'waiting') desc, (s.state = 'queued'), s.id desc
    )
    select c.id, c.number::text as number, c.title, c.risk, c.status,
      e.key as environment_key, e.name as environment_name, c.requested_by,
      u.name as requester_name, c.created_at,
      (select jsonb_agg(jsonb_build_object('application', a.key, 'toVersion', r.version)
          order by a.key)
        from pipeline_change_request_items i
        join pipeline_applications a on a.id = i.application_id
        join pipeline_releases r on r.id = i.release_id
        where i.change_request_id = c.id) as items,
      coalesce((select count(*)::int from pipeline_change_request_approvals ap
        where ap.step_id = cs.id and ap.decision = 'approved'), 0) as got,
      coalesce(cs.count, 0) as needed,
      (c.status = 'waiting' and exists (
        select 1 from pipeline_change_request_picks p
        join pipeline_change_request_steps s on s.id = p.step_id
        where s.change_request_id = c.id and s.state = 'waiting' and p.user_id = ${viewer}
          and not exists (select 1 from pipeline_change_request_approvals ap
            where ap.step_id = s.id and ap.user_id = ${viewer}))) as waiting_for_me
    from pipeline_change_requests c
    join pipeline_environments e on e.id = c.environment_id
    left join users u on u.id = c.requested_by
    left join current_step cs on cs.change_request_id = c.id
    where true
      ${query.environment ? sql`and e.key = ${query.environment}` : sql``}
      ${query.tab === 'open' ? sql`and c.status = any(${OPEN}::text[])` : sql``}
      ${query.tab === 'done' ? sql`and c.status = any(${DONE}::text[])` : sql``}
      ${query.tab === 'mine' ? sql`and c.requested_by = ${viewer}` : sql``}
      ${
        query.tab === 'decided'
          ? sql`and exists (select 1 from pipeline_change_request_approvals ap
              join pipeline_change_request_steps s on s.id = ap.step_id
              where s.change_request_id = c.id and ap.user_id = ${viewer})`
          : sql``
      }
      ${
        // A draft is the requester's alone until it is sent.
        query.tab === 'mine' ? sql`` : sql`and (c.status <> 'draft' or c.requested_by = ${viewer})`
      }
      ${after ? sql`and c.id < ${after}::uuid` : sql``}
    order by c.id desc
    limit ${query.tab === 'waiting_for_me' ? 500 : query.limit + 1}`;
  const wanted =
    query.tab === 'waiting_for_me'
      ? rows.filter((row) => row.waiting_for_me).slice(0, query.limit + 1)
      : rows;
  const items: ChangeRequestSummary[] = wanted.map((row) => ({
    id: row.id,
    number: `CHG-${row.number}`,
    title: row.title,
    risk: row.risk,
    environment: { key: row.environment_key, name: row.environment_name },
    status: row.status,
    requestedBy: person(row.requested_by, row.requester_name),
    serviceCount: row.items?.length ?? 0,
    items: row.items ?? [],
    approvalsGot: Math.min(row.got, row.needed),
    approvalsNeeded: row.needed,
    waitingForMe: row.waiting_for_me,
    createdAt: new Date(row.created_at).toISOString(),
  }));
  const page = toPage(items, query.limit);
  return { items: page.rows, nextCursor: page.nextCursor };
}
