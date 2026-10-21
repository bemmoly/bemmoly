import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import type { InitiativeEpicCounts, RoadmapProgress } from '../../../../shared/index.ts';
import { accessibleProjectIds, projectResource } from '../issues/deps.ts';

/*
 * An initiative's rolled-up progress: its epics, how many are done, and the issues under them,
 * summed. Only epics in projects the person can open count; the others are counted as hidden,
 * so the numbers never show work the person could not open. Deleted and archived epics, and
 * epics of archived projects, are left out, as the roadmap leaves them out.
 */

export interface RollupRow {
  initiative_id: string;
  epic_id: string;
  project_id: string;
  epic_done: boolean;
  total: number;
  done: number;
  in_progress: number;
  points: string;
  points_done: string;
}

export interface Rollup {
  epics: InitiativeEpicCounts;
  progress: RoadmapProgress;
  projectIds: string[];
}

export async function loadRollupRows(
  sql: SqlExecutor,
  initiativeIds: readonly string[],
): Promise<RollupRow[]> {
  if (initiativeIds.length === 0) return [];
  return sql<RollupRow[]>`
    select ie.initiative_id, e.id as epic_id, e.project_id, s.category = 'done' as epic_done,
      count(w.id)::int as total,
      count(w.id) filter (where ws.category = 'done')::int as done,
      count(w.id) filter (where ws.category = 'in_progress')::int as in_progress,
      coalesce(sum(w.estimate), 0)::text as points,
      coalesce(sum(w.estimate) filter (where ws.category = 'done'), 0)::text as points_done
    from initiative_epics ie
    join issues e on e.id = ie.epic_id and e.deleted_at is null and e.archived_at is null
    join projects p on p.id = e.project_id and p.archived_at is null
    join workflow_statuses s on s.id = e.status_id
    left join issues w on w.parent_id = e.id and w.deleted_at is null and w.archived_at is null
      and exists (select 1 from issue_types t where t.id = w.type_id and t.level = 'standard')
    left join workflow_statuses ws on ws.id = w.status_id
    where ie.initiative_id = any(${initiativeIds}::uuid[])
    group by ie.initiative_id, e.id, e.project_id, s.category
    order by ie.initiative_id, e.project_id, e.id`;
}

const empty = (): Rollup => ({
  epics: { total: 0, done: 0, hidden: 0 },
  progress: { total: 0, done: 0, inProgress: 0, points: 0, pointsDone: 0 },
  projectIds: [],
});

/** Sums the rows per initiative; `visible` says which projects the person can open. */
export function rollUp(
  rows: readonly RollupRow[],
  visible: (projectId: string) => boolean,
): Map<string, Rollup> {
  const out = new Map<string, Rollup>();
  for (const row of rows) {
    const entry = out.get(row.initiative_id) ?? empty();
    out.set(row.initiative_id, entry);
    if (!visible(row.project_id)) {
      entry.epics.hidden += 1;
      continue;
    }
    entry.epics.total += 1;
    if (row.epic_done) entry.epics.done += 1;
    entry.progress.total += row.total;
    entry.progress.done += row.done;
    entry.progress.inProgress += row.in_progress;
    entry.progress.points += Number(row.points);
    entry.progress.pointsDone += Number(row.points_done);
    if (!entry.projectIds.includes(row.project_id)) entry.projectIds.push(row.project_id);
  }
  return out;
}

export const rollupOf = (rollups: ReadonlyMap<string, Rollup>, id: string): Rollup =>
  rollups.get(id) ?? empty();

/** The projects among `projectIds` the person may read issues in. */
export async function visibleProjects(
  ctx: RequestContext,
  sql: SqlExecutor,
  projectIds: readonly string[],
): Promise<Set<string>> {
  const unique = [...new Set(projectIds)];
  if (unique.length === 0) return new Set();
  const member = await accessibleProjectIds(ctx, sql);
  const candidates = member === null ? unique : unique.filter((id) => member.includes(id));
  const allowed = await Promise.all(
    candidates.map((id) => ctx.authz.can(ctx.actor, 'work.issue.view', projectResource(id))),
  );
  return new Set(candidates.filter((_, index) => allowed[index]));
}
