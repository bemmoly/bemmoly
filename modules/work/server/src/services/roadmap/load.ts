import type { SqlExecutor } from '@bemmoly/core';
import type { StatusCategory, VersionStatus, WorkMethod } from '../../../../shared/index.ts';
import { BOARD_COLUMNS, type BoardRow } from '../boards/rows.ts';
import { computeBoardMetrics } from '../metrics/index.ts';
import { loadFlow, loadVelocity, statusSets } from '../metrics/load.ts';
import type { ProjectRecord } from './history.ts';

/*
 * The reads behind the roadmap, one statement each across every project in view: the
 * projects, their epics and versions, the issues under them, the epic-level "blocks" links,
 * and each project's history. History comes from the Board's own metrics (cached per board in
 * sprint_metrics), so the roadmap and the board agree on how fast a team goes.
 */

export interface ProjectRow {
  id: string;
  key: string;
  name: string;
  team_id: string | null;
  method: WorkMethod;
}

export async function loadProjects(
  sql: SqlExecutor,
  filter: { keys: readonly string[] | null; teamId: string | null; ids: readonly string[] | null },
): Promise<ProjectRow[]> {
  return sql<ProjectRow[]>`
    select id, key, name, team_id, method from projects
    where archived_at is null
      and (${filter.keys === null} or key = any(${filter.keys ?? []}::text[]))
      and (${filter.teamId}::uuid is null or team_id = ${filter.teamId}::uuid)
      and (${filter.ids === null} or id = any(${filter.ids ?? []}::uuid[]))
    order by name, key`;
}

export interface EpicRow {
  id: string;
  project_id: string;
  key: string;
  title: string;
  color: string | null;
  start_at: string | null;
  due_at: string | null;
  target_date: string | null;
  owner_id: string | null;
  category: StatusCategory;
}

export async function loadEpics(sql: SqlExecutor, projectIds: readonly string[]) {
  return sql<EpicRow[]>`
    select e.id, e.project_id, e.key, e.title, e.color, e.start_at::text as start_at,
      e.due_at::text as due_at, e.custom_fields->>'target_date' as target_date,
      e.custom_fields->>'owner' as owner_id, s.category
    from issues e
    join issue_types t on t.id = e.type_id and t.level = 'epic'
    join workflow_statuses s on s.id = e.status_id
    where e.project_id = any(${projectIds}::uuid[]) and e.deleted_at is null and e.archived_at is null
    order by e.project_id, e.rank collate "C", e.id`;
}

export interface WorkRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  fix_version_id: string | null;
  key: string;
  title: string;
  type_id: string;
  assignee_id: string | null;
  estimate: string | null;
  start_at: string | null;
  due_at: string | null;
  status_name: string;
  category: StatusCategory;
}

/** The standard issues under an epic or naming a version: the work the forecast counts. */
export async function loadWork(sql: SqlExecutor, projectIds: readonly string[]) {
  return sql<WorkRow[]>`
    select i.id, i.project_id, i.parent_id, i.fix_version_id, i.key, i.title, i.type_id,
      i.assignee_id, i.estimate::text as estimate, i.start_at::text as start_at,
      i.due_at::text as due_at, s.name as status_name, s.category
    from issues i
    join issue_types t on t.id = i.type_id and t.level = 'standard'
    join workflow_statuses s on s.id = i.status_id
    where i.project_id = any(${projectIds}::uuid[]) and i.deleted_at is null and i.archived_at is null
      and (i.parent_id is not null or i.fix_version_id is not null)
    order by i.rank collate "C", i.id`;
}

export interface VersionRow {
  id: string;
  project_id: string;
  name: string;
  start_at: string | null;
  release_at: string | null;
  status: VersionStatus;
}

export async function loadVersions(sql: SqlExecutor, projectIds: readonly string[]) {
  return sql<VersionRow[]>`
    select id, project_id, name, start_at::text as start_at, release_at::text as release_at,
      status
    from versions
    where project_id = any(${projectIds}::uuid[]) and status <> 'archived'
    order by project_id, release_at nulls last, lower(name), id`;
}

export async function loadBlocks(sql: SqlExecutor, epicIds: readonly string[]) {
  return sql<{ id: string; source_id: string; target_id: string }[]>`
    select id, source_id, target_id from issue_links
    where kind = 'blocks' and source_id = any(${epicIds}::uuid[])
      and target_id = any(${epicIds}::uuid[])
    order by id`;
}

/**
 * The projects whose epics keep their target in a "Target date" field (the org default
 * scheme gives every epic one), so a moved bar writes the date where the epic shows it.
 */
export async function loadTargetFields(sql: SqlExecutor, projectIds: readonly string[]) {
  const rows = await sql<{ project_id: string | null }[]>`
    select project_id from fields
    where key = 'target_date' and kind = 'date'
      and (project_id is null or project_id = any(${projectIds}::uuid[]))`;
  const everywhere = rows.some((row) => row.project_id === null);
  return new Set(
    projectIds.filter((id) => everywhere || rows.some((row) => row.project_id === id)),
  );
}

export async function loadTeams(sql: SqlExecutor, teamIds: readonly string[]) {
  if (teamIds.length === 0) return [];
  return sql<{ id: string; name: string }[]>`
    select id, name from teams where id = any(${teamIds}::uuid[]) order by name, id`;
}

interface Pace {
  project_id: string;
  sprint_days: string | null;
  open_issues: number;
  estimated_issues: number;
  mean_estimate: string | null;
}

/** Each project's mean sprint length over its last six closed sprints, and its estimates. */
async function loadPace(sql: SqlExecutor, projectIds: readonly string[]) {
  return sql<Pace[]>`
    with recent as (
      select project_id,
        extract(epoch from (coalesce(closed_at, ends_at) - coalesce(started_at, starts_at)))
          / 86400 as days,
        row_number() over (partition by project_id order by closed_at desc nulls last, id desc)
          as n
      from sprints where state = 'closed' and project_id = any(${projectIds}::uuid[])
    ), open as (
      select i.project_id, count(*)::int as open_issues,
        count(i.estimate)::int as estimated_issues, avg(i.estimate)::text as mean_estimate
      from issues i
      join issue_types t on t.id = i.type_id and t.level = 'standard'
      join workflow_statuses s on s.id = i.status_id
      where i.project_id = any(${projectIds}::uuid[]) and i.deleted_at is null and i.archived_at is null
        and s.category <> 'done'
      group by i.project_id
    )
    select p.id as project_id,
      (select avg(days)::text from recent r where r.project_id = p.id and n <= 6 and days > 0)
        as sprint_days,
      coalesce(o.open_issues, 0) as open_issues, coalesce(o.estimated_issues, 0)
        as estimated_issues, o.mean_estimate
    from unnest(${projectIds}::uuid[]) as p(id)
    left join open o on o.project_id = p.id`;
}

const VELOCITY_SPRINTS = 6;

/** The Board's velocity and throughput for one project, through its cache when it has a board. */
async function metricsOf(
  sql: SqlExecutor,
  project: ProjectRow,
  board: BoardRow | undefined,
  now: Date,
) {
  if (board) {
    const metrics = await computeBoardMetrics(sql, board, VELOCITY_SPRINTS, now, project);
    return {
      velocity: metrics.velocity.map((point) => point.completedPoints),
      throughput: metrics.throughputHistory,
    };
  }
  const sets = await statusSets(sql, project.id, null);
  const [velocity, flow] = await Promise.all([
    loadVelocity(sql, project.id, VELOCITY_SPRINTS),
    loadFlow(sql, project.id, sets, now),
  ]);
  return {
    velocity: velocity.map((point) => point.completedPoints),
    throughput: flow.throughputHistory,
  };
}

/** What each project's forecasts replay, by project id. */
export async function loadRecords(
  sql: SqlExecutor,
  projects: readonly ProjectRow[],
  now: Date,
): Promise<Map<string, ProjectRecord>> {
  const ids = projects.map((project) => project.id);
  if (ids.length === 0) return new Map();
  const [paces, boards] = await Promise.all([
    loadPace(sql, ids),
    sql<BoardRow[]>`
      select ${sql.unsafe(BOARD_COLUMNS)} from boards
      where project_id = any(${ids}::uuid[]) order by id`,
  ]);
  const records = await Promise.all(
    projects.map(async (project): Promise<ProjectRecord> => {
      const board = boards.find((row) => row.project_id === project.id);
      const metrics = await metricsOf(sql, project, board, now);
      const pace = paces.find((row) => row.project_id === project.id);
      return {
        id: project.id,
        name: project.name,
        method: project.method,
        velocity: metrics.velocity,
        sprintDays: pace?.sprint_days ? Math.round(Number(pace.sprint_days) * 10) / 10 : null,
        throughput: metrics.throughput,
        openIssues: pace?.open_issues ?? 0,
        estimatedIssues: pace?.estimated_issues ?? 0,
        meanEstimate: pace?.mean_estimate ? Number(pace.mean_estimate) : null,
      };
    }),
  );
  return new Map(records.map((record) => [record.id, record]));
}
