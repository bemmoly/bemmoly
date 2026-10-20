import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type {
  RoadmapDependency,
  RoadmapItem,
  RoadmapQuery,
  RoadmapView,
} from '../../../../shared/roadmap.ts';
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
import { initiativeById } from '../initiatives/rows.ts';
import {
  loadBlocks,
  loadEpics,
  loadInitiativeEpicIds,
  loadProjects,
  loadRecords,
  loadTargetFields,
  loadTeams,
  loadVersions,
  loadWork,
  type BlockRow,
  type ProjectRow,
  type WorkRow,
} from './load.ts';

/*
 * The roadmap (tech design §14, "Roadmap and forecast"): every epic and live version in the
 * projects a person can open, or in the ones a link names, with the epic-level dependencies
 * and a forecast for each. Read-only; dates move through the issue and version PATCHes, so
 * history, audit and realtime stay theirs.
 */

/** The projects an initiative's live epics belong to. */
async function initiativeProjectIds(sql: SqlExecutor, epicIds: ReadonlySet<string>) {
  const rows = await sql<{ project_id: string }[]>`
    select distinct project_id from issues
    where id = any(${[...epicIds]}::uuid[]) and deleted_at is null`;
  return rows.map((row) => row.project_id);
}

/**
 * The projects in view: the ones named, each authorized, or every one the person can open;
 * for an initiative, only the ones its epics belong to.
 */
async function projectsInView(
  ctx: RequestContext,
  sql: SqlExecutor,
  query: RoadmapQuery,
  initiativeEpics: ReadonlySet<string> | null,
): Promise<ProjectRow[]> {
  const keys = query.projects ?? null;
  const teamId = query.teamId ?? null;
  if (initiativeEpics) {
    const member = await accessibleProjectIds(ctx, sql);
    const ids = (await initiativeProjectIds(sql, initiativeEpics)).filter(
      (id) => member === null || member.includes(id),
    );
    const rows = await loadProjects(sql, { keys, teamId, ids });
    const allowed = await Promise.all(
      rows.map((row) => ctx.authz.can(ctx.actor, 'work.issue.view', projectResource(row.id))),
    );
    return rows.filter((_, index) => allowed[index]);
  }
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

/** The links whose ends are both on screen, each saying whether its dates conflict. */
function dependenciesBetween(items: readonly RoadmapItem[], blocks: readonly BlockRow[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return blocks.flatMap((link): RoadmapDependency[] => {
    const from = byId.get(link.from_id);
    const to = byId.get(link.to_id);
    if (!from || !to) return [];
    return [
      {
        id: link.id,
        fromId: link.from_id,
        toId: link.to_id,
        via: link.direct ? 'epic' : 'issue',
        links: link.links,
        conflict: Boolean(from.end && to.start && to.start < from.end),
      },
    ];
  });
}

export function createRoadmapService(deps: PlanningDeps) {
  const now = () => deps.now?.() ?? new Date();

  return {
    async view(ctx: RequestContext, query: RoadmapQuery): Promise<RoadmapView> {
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', MODULE_RESOURCE);
      const sql = requireDatabase(deps);
      const at = now();
      const today = dayOf(at);
      if (query.initiative) await initiativeById(sql, query.initiative);
      const initiativeEpics = query.initiative
        ? await loadInitiativeEpicIds(sql, query.initiative)
        : null;
      const projects = await projectsInView(ctx, sql, query, initiativeEpics);
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
      const forecasts = forecastAll(inputs, {
        today,
        projects: histories,
        dependencies: blocks.map((link) => ({
          id: link.id,
          fromId: link.from_id,
          toId: link.to_id,
        })),
      });
      const all: RoadmapItem[] = built.map((entry, index) => {
        const allowed = may.get(entry.item.projectId);
        return {
          ...entry.item,
          canSchedule: Boolean(entry.item.kind === 'epic' ? allowed?.epics : allowed?.versions),
          forecast: forecasts.get(entry.item.id) ?? missingForecast(inputs[index] ?? entry.input),
        };
      });
      // An initiative's forecasts count every epic sharing its teams; it shows only its own.
      const items = initiativeEpics ? all.filter((item) => initiativeEpics.has(item.id)) : all;
      const dependencies = dependenciesBetween(items, blocks);
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
