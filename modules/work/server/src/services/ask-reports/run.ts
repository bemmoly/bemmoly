import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import type { ReportResult, ReportSpec } from '../../../../shared/ask-reports.ts';
import { resolveProject, type PlanningProject } from '../boards/context.ts';
import { actorUserId, projectResource } from '../issues/deps.ts';
import { computeReport } from './compute.ts';
import { loadGroupValues, loadReportIssues } from './load.ts';

/*
 * Runs a validated report spec for one person: the project is resolved and authorized as
 * every Reports read is, then the spec's fixed fragments select the issues and the numbers
 * are worked out in compute.ts. Asked and pinned reports both come through here.
 */

/** The project, after the person was allowed to read its issues. */
export async function readableProject(
  sql: SqlExecutor,
  ctx: RequestContext,
  ref: string,
): Promise<PlanningProject> {
  const project = await resolveProject(sql, ref);
  await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(project.id));
  return project;
}

export async function runReportSpec(
  sql: SqlExecutor,
  ctx: RequestContext,
  projectId: string,
  spec: ReportSpec,
  now: Date,
): Promise<ReportResult> {
  const [issues, values] = await Promise.all([
    loadReportIssues(sql, projectId, spec.filters, actorUserId(ctx)),
    loadGroupValues(sql, projectId, spec.groupBy),
  ]);
  return computeReport({ spec, issues, values, now });
}

export interface ProjectVocabulary {
  name: string;
  statuses: string[];
  types: string[];
}

/** What the model is told about the project: names only, never issue text. */
export async function projectVocabulary(
  sql: SqlExecutor,
  projectId: string,
): Promise<ProjectVocabulary> {
  const [project, statuses, types] = await Promise.all([
    sql<{ name: string }[]>`select name from projects where id = ${projectId}`,
    sql<{ name: string; category: string }[]>`
      select distinct s.name, s.category from issues i
      join workflow_statuses s on s.id = i.status_id
      where i.project_id = ${projectId} and i.deleted_at is null order by s.name`,
    sql<{ name: string }[]>`
      select distinct t.name from issues i join issue_types t on t.id = i.type_id
      where i.project_id = ${projectId} and i.deleted_at is null order by t.name`,
  ]);
  return {
    name: project[0]?.name ?? '',
    statuses: statuses.map((row) => `${row.name} (${row.category})`),
    types: types.map((row) => row.name),
  };
}
