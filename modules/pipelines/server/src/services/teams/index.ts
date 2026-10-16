import { decodeCursor, toPage, type RequestContext } from '@bemmoly/core';
import type { ListTeamsQuery, PipelinesTeam, TeamsPage } from '../../../../shared/environments.ts';
import type { TeamRow } from '../../models/environments.ts';
import { escapeLike } from '../../utils/time.ts';
import {
  authorizePipelines,
  personOf,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';

const toTeam = (row: TeamRow): PipelinesTeam => ({
  id: row.id,
  name: row.name,
  memberCount: row.member_count,
  applicationCount: row.application_count,
  mine: row.mine,
});

/**
 * The kernel's teams, as Pipelines needs them: how many applications each owns and whether
 * the person asking is in it. Teams themselves are managed in the kernel (SCIM, SSO groups).
 */
export function createTeamsService(deps: PipelinesServiceDeps) {
  return {
    async list(ctx: RequestContext, query: ListTeamsQuery): Promise<TeamsPage> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const me = personOf(ctx.actor);
      const after = decodeCursor(query.cursor);
      const rows = await sql<TeamRow[]>`
        select t.id, t.name,
          (select count(*) from team_members m where m.team_id = t.id)::int as member_count,
          (select count(*) from pipeline_applications a
            where a.owner_team_id = t.id and a.archived_at is null)::int as application_count,
          exists (select 1 from team_members m
            where m.team_id = t.id and m.user_id = ${me}::uuid) as mine
        from teams t
        where true
          ${query.q ? sql`and lower(t.name) like ${`%${escapeLike(query.q.toLowerCase())}%`}` : sql``}
          ${
            query.mine
              ? sql`and t.id in (select team_id from team_members where user_id = ${me}::uuid)`
              : sql``
          }
          ${
            after
              ? sql`and (lower(t.name), t.id) > (
                  select lower(name), id from teams where id = ${after}::uuid)`
              : sql``
          }
        order by lower(t.name), t.id
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toTeam), nextCursor: page.nextCursor };
    },
  };
}

export type TeamsService = ReturnType<typeof createTeamsService>;
