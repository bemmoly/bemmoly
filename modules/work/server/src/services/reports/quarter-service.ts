import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import {
  quarterBounds,
  quarterOf,
  type QuarterRef,
  type QuarterReport,
} from '../../../../shared/quarter.ts';
import { sprintSnapshotSchema } from '../../../../shared/sprints.ts';
import { resolveProject, type PlanningDeps } from '../boards/context.ts';
import { projectResource, requireDatabase } from '../issues/deps.ts';
import { statusSets } from '../metrics/load.ts';
import {
  quarterReport,
  type QuarterEpicRow,
  type QuarterIssue,
  type QuarterSprintRow,
} from './quarter.ts';

/*
 * The quarter view: a project's sprints, epics and completed work over one calendar quarter,
 * rebuilt from the issues and the sprints' completion snapshots on read.
 */

const time = (value: Date | string | null): number | null =>
  value === null ? null : new Date(value).getTime();
const iso = (instant: number) => new Date(instant).toISOString();

async function loadIssues(
  sql: SqlExecutor,
  projectId: string,
  done: readonly string[],
  start: number,
  end: number,
): Promise<QuarterIssue[]> {
  const rows = await sql<
    {
      id: string;
      parent_id: string | null;
      estimate: string | null;
      created_at: Date;
      resolved_at: Date | null;
      deleted_at: Date | null;
      done: boolean;
    }[]
  >`
    select i.id, i.parent_id, i.estimate, i.created_at, i.resolved_at, i.deleted_at,
      i.status_id = any(${done}::uuid[]) as done
    from issues i join issue_types t on t.id = i.type_id
    where i.project_id = ${projectId} and t.level <> 'epic'
      and i.created_at < ${iso(end)}::timestamptz
      and (i.deleted_at is null or i.deleted_at >= ${iso(start)}::timestamptz)`;
  return rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    points: row.estimate === null ? 0 : Number(row.estimate),
    createdAt: time(row.created_at) ?? 0,
    resolvedAt: time(row.resolved_at),
    deletedAt: time(row.deleted_at),
    done: row.done,
  }));
}

async function loadSprints(
  sql: SqlExecutor,
  projectId: string,
  done: readonly string[],
): Promise<QuarterSprintRow[]> {
  const rows = await sql<
    {
      id: string;
      name: string;
      state: QuarterSprintRow['state'];
      starts_at: Date | null;
      ends_at: Date | null;
      started_at: Date | null;
      closed_at: Date | null;
      snapshot: unknown;
      points: string | null;
      done_points: string | null;
    }[]
  >`
    select s.id, s.name, s.state, s.starts_at, s.ends_at, s.started_at, s.closed_at,
      coalesce(m.data, s.completed_snapshot) as snapshot,
      (select sum(i.estimate) from issues i
        where i.sprint_id = s.id and i.deleted_at is null) as points,
      (select sum(i.estimate) from issues i where i.sprint_id = s.id and i.deleted_at is null
        and i.status_id = any(${done}::uuid[])) as done_points
    from sprints s
    left join sprint_metrics m
      on m.scope_kind = 'sprint' and m.scope_id = s.id and m.kind = 'completion'
    where s.project_id = ${projectId}`;
  return rows.map((row) => {
    const snapshot = sprintSnapshotSchema.safeParse(row.snapshot);
    return {
      id: row.id,
      name: row.name,
      state: row.state,
      startsAt: time(row.starts_at),
      endsAt: time(row.ends_at),
      startedAt: time(row.started_at),
      closedAt: time(row.closed_at),
      snapshot: snapshot.success ? snapshot.data : null,
      points: Number(row.points ?? 0),
      donePoints: Number(row.done_points ?? 0),
    };
  });
}

async function loadEpics(
  sql: SqlExecutor,
  projectId: string,
  done: readonly string[],
): Promise<QuarterEpicRow[]> {
  const rows = await sql<
    { id: string; key: string; title: string; done: boolean; created_at: Date }[]
  >`
    select i.id, i.key, i.title, i.status_id = any(${done}::uuid[]) as done, i.created_at
    from issues i join issue_types t on t.id = i.type_id
    where i.project_id = ${projectId} and i.deleted_at is null and t.level = 'epic'`;
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    title: row.title,
    done: row.done,
    createdAt: time(row.created_at) ?? 0,
  }));
}

export function createQuarterService(deps: Pick<PlanningDeps, 'database' | 'now'>) {
  return {
    async quarter(
      ctx: RequestContext,
      ref: string,
      query: { quarter?: QuarterRef | undefined },
    ): Promise<QuarterReport> {
      const sql = requireDatabase(deps);
      const project = await resolveProject(sql, ref);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(project.id));
      const now = (deps.now?.() ?? new Date()).getTime();
      const quarter = query.quarter ?? quarterOf(now);
      const { start, end } = quarterBounds(quarter);
      const done = [...(await statusSets(sql, project.id, null)).done];
      const [issues, sprints, epics] = await Promise.all([
        loadIssues(sql, project.id, done, start, end),
        loadSprints(sql, project.id, done),
        loadEpics(sql, project.id, done),
      ]);
      return quarterReport({ quarter, now, issues, sprints, epics });
    },
  };
}

export type QuarterService = ReturnType<typeof createQuarterService>;
