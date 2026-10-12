import type { RequestContext, SettingsRegistry } from '@bemmoly/core';
import type { PairingMatrix, PairingQuery } from '../../../../shared/pairing.ts';
import { resolveProject, type PlanningDeps } from '../boards/context.ts';
import { projectResource, requireDatabase } from '../issues/deps.ts';
import { suggestPairs } from './suggest.ts';

const DAY = 86_400_000;
const DEFAULT_DAYS = 90;

interface PersonRow {
  id: string;
  name: string;
  issues: number;
}

interface CellRow {
  a: string;
  b: string;
  count: number;
  hours: string | number;
  last_paired_at: Date | string;
  issues: { key: string; title: string }[];
}

const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/** The window as days and as the instants it covers: from midnight to the end of `to`, UTC. */
export function pairingRange(query: PairingQuery, now: Date) {
  const to = query.to ?? isoDay(now.getTime());
  const from = query.from ?? isoDay(Date.parse(to) - (DEFAULT_DAYS - 1) * DAY);
  return {
    from,
    to,
    start: new Date(from).toISOString(),
    end: new Date(Date.parse(to) + DAY).toISOString(),
  };
}

/*
 * Each stint is clipped to the window, with an open one running to now, and two stints on one
 * issue pair when the clipped spans overlap. Deleted issues still count: the pairing happened.
 */
export function createPairingService(
  deps: Pick<PlanningDeps, 'database' | 'now'> & { settings?: Pick<SettingsRegistry, 'get'> },
) {
  return {
    async matrix(ctx: RequestContext, projectRef: string, query: PairingQuery) {
      const sql = requireDatabase(deps);
      const project = await resolveProject(sql, projectRef);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(project.id));
      const range = pairingRange(query, deps.now?.() ?? new Date());
      const stints = sql`
        select ia.issue_id, ia.user_id,
          greatest(ia.added_at, ${range.start}::timestamptz) as starts,
          least(coalesce(ia.removed_at, now()), ${range.end}::timestamptz) as ends
        from issue_assignees ia join issues i on i.id = ia.issue_id
        where i.project_id = ${project.id}
          and ia.added_at < ${range.end}::timestamptz
          and coalesce(ia.removed_at, now()) > ${range.start}::timestamptz`;
      const [people, cells] = await Promise.all([
        sql<PersonRow[]>`
          with s as (${stints})
          select u.id, u.name, count(distinct s.issue_id)::int as issues
          from s join users u on u.id = s.user_id
          group by u.id, u.name order by issues desc, u.name`,
        sql<CellRow[]>`
          with s as (${stints}),
          pairs as (
            select x.user_id as a, y.user_id as b, x.issue_id,
              least(x.ends, y.ends) - greatest(x.starts, y.starts) as together,
              least(x.ends, y.ends) as last_at
            from s x join s y on y.issue_id = x.issue_id and x.user_id < y.user_id
            where greatest(x.starts, y.starts) < least(x.ends, y.ends)
          ),
          per_issue as (
            select a, b, issue_id, sum(together) as together, max(last_at) as last_at
            from pairs group by a, b, issue_id
          )
          select p.a, p.b, count(*)::int as count,
            round((extract(epoch from sum(p.together)) / 3600)::numeric, 1) as hours,
            max(p.last_at) as last_paired_at,
            (select coalesce(jsonb_agg(jsonb_build_object('key', r.key, 'title', r.title)
               order by r.last_at desc), '[]'::jsonb)
             from (select i.key, i.title, q.last_at from per_issue q
               join issues i on i.id = q.issue_id
               where q.a = p.a and q.b = p.b order by q.last_at desc limit 10) r) as issues
          from per_issue p group by p.a, p.b`,
      ]);
      const suggesting = (await deps.settings?.get('work.pairing.suggestions')) ?? false;
      const matrix: PairingMatrix = {
        from: range.from,
        to: range.to,
        people,
        cells: cells.map((cell) => ({
          a: cell.a,
          b: cell.b,
          count: cell.count,
          hours: Number(cell.hours),
          lastPairedAt: new Date(cell.last_paired_at).toISOString(),
          issues: cell.issues,
        })),
      };
      if (!suggesting) return matrix;
      return {
        ...matrix,
        suggestions: suggestPairs(
          people.map((person) => person.id),
          matrix.cells,
        ),
      };
    },
  };
}

export type PairingService = ReturnType<typeof createPairingService>;
