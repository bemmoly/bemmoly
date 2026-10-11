import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { RoadmapItem, RoadmapQuery, RoadmapView } from '../../../../shared/roadmap.ts';
import type { PlanningDeps } from '../boards/context.ts';
import {
  accessibleProjectIds,
  MODULE_RESOURCE,
  projectResource,
  requireDatabase,
} from '../issues/deps.ts';
import { buildEpic, buildVersion, missingForecast, shareTheTeam, type Built } from './build.ts';
import { dayOf, fromDay } from './days.ts';
import { forecastAll, type ForecastProject } from './forecast.ts';
import { projectHistory } from './history.ts';
import {
  loadBlocks,
  loadEpics,
  loadProjects,
  loadRecords,
  loadTargetFields,
  loadTeams,
  loadVersions,
  loadWork,
  type ProjectRow,
  type WorkRow,
} from './load.ts';

/*
 * The roadmap (tech design §14, "Roadmap and forecast"): every epic and live version in the
 * projects a person can open, or in the ones a link names, with the epic-level dependencies
 * and a forecast for each. Read-only; dates move through the issue and version PATCHes, so
 * history, audit and realtime stay theirs.
 */

/** The projects in view: the ones named, each authorized, or every one the person can open. */
async function projectsInView(
  ctx: RequestContext,
  sql: SqlExecutor,
  query: RoadmapQuery,
): Promise<ProjectRow[]> {
  const keys = query.projects ?? null;
  const teamId = query.teamId ?? null;
  if (keys) {
    const rows = await loadProjects(sql, { keys, teamId, ids: null });
    const missing = keys.filter((key) => !rows.some((row) => row.key === key));
    if (missing.length > 0) throw new NotFoundError(`There is no project ${missing.join(', ')}`);
    for (const row of rows) {
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(row.id));
    }
    return rows;
  }
  const rows = await loadProjects(sql, { keys, teamId, ids: await accessibleProjectIds(ctx, sql) });
  const allowed = await Promise.all(
    rows.map((row) => ctx.authz.can(ctx.actor, 'work.issue.view', projectResource(row.id))),
  );
  return rows.filter((_, index) => allowed[index]);
}

const groupBy = <T>(rows: readonly T[], key: (row: T) => string | null) => {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    if (id === null) continue;
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  return groups;
};

/** Who may move each project's epics and versions. */
async function schedulers(ctx: RequestContext, projects: readonly ProjectRow[]) {
  const entries = await Promise.all(
    projects.map(async (project) => {
      const resource = projectResource(project.id);
      const [epics, versions] = await Promise.all([
        ctx.authz.can(ctx.actor, 'work.issue.edit', resource),
        ctx.authz.can(ctx.actor, 'work.project.configure', resource),
      ]);
      return [project.id, { epics, versions }] as const;
    }),
  );
  return new Map(entries);
}

export function createRoadmapService(deps: PlanningDeps) {
  const now = () => deps.now?.() ?? new Date();

  return {
    async view(ctx: RequestContext, query: RoadmapQuery): Promise<RoadmapView> {
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', MODULE_RESOURCE);
      const sql = requireDatabase(deps);
      const at = now();
      const today = dayOf(at);
      const projects = await projectsInView(ctx, sql, query);
      const ids = projects.map((project) => project.id);
      const [epics, work, versions, records, may, targets] = await Promise.all([
        loadEpics(sql, ids),
        loadWork(sql, ids),
        loadVersions(sql, ids),
        loadRecords(sql, projects, at),
        schedulers(ctx, projects),
        loadTargetFields(sql, ids),
      ]);
      const [blocks, teams] = await Promise.all([
        loadBlocks(
          sql,
          epics.map((epic) => epic.id),
        ),
        loadTeams(sql, [
          ...new Set(projects.flatMap((project) => (project.team_id ? [project.team_id] : []))),
        ]),
      ]);
      const underEpic = groupBy<WorkRow>(work, (row) => row.parent_id);
      const inVersion = groupBy<WorkRow>(work, (row) => row.fix_version_id);
      const built: Built[] = epics.map((epic) =>
        buildEpic(epic, underEpic.get(epic.id) ?? [], today, targets.has(epic.project_id)),
      );
      for (const [index, version] of versions.entries()) {
        const before = versions[index - 1];
        const previous = before?.project_id === version.project_id ? before.release_at : null;
        built.push(buildVersion(version, previous, inVersion.get(version.id) ?? [], today));
      }
      const histories = new Map<string, ForecastProject>();
      for (const project of projects) {
        const record = records.get(project.id);
        if (record) histories.set(project.id, { name: project.name, ...projectHistory(record) });
      }
      const inputs = shareTheTeam(built);
      const dependencies = blocks.map((link) => ({
        id: link.id,
        fromId: link.source_id,
        toId: link.target_id,
      }));
      const forecasts = forecastAll(inputs, { today, projects: histories, dependencies });
      const items: RoadmapItem[] = built.map((entry, index) => {
        const allowed = may.get(entry.item.projectId);
        return {
          ...entry.item,
          canSchedule: Boolean(entry.item.kind === 'epic' ? allowed?.epics : allowed?.versions),
          forecast: forecasts.get(entry.item.id) ?? missingForecast(inputs[index] ?? entry.input),
        };
      });
      return {
        today: fromDay(today),
        projects: projects.map((project) => ({
          id: project.id,
          key: project.key,
          name: project.name,
          teamId: project.team_id,
          method: project.method,
          history: histories.get(project.id)?.history ?? null,
        })),
        teams,
        items,
        dependencies,
        computedAt: at.toISOString(),
      };
    },
  };
}

export type RoadmapService = ReturnType<typeof createRoadmapService>;
