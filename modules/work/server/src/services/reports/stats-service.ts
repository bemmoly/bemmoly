import type { RequestContext } from '@bemmoly/core';
import type { ReportStats, StatField } from '../../../../shared/report-stats.ts';
import { resolveProject, type PlanningDeps } from '../boards/context.ts';
import { projectResource, requireDatabase } from '../issues/deps.ts';
import { fieldStats } from './stats.ts';
import { loadFieldValues, loadStatIssues } from './stats-load.ts';

/*
 * Field statistics, Jira's pie chart and two-dimensional filter statistics:
 * counts of the project's live issues by one field or two crossed.
 */
export function createStatsService(deps: Pick<PlanningDeps, 'database'>) {
  return {
    async stats(
      ctx: RequestContext,
      ref: string,
      query: { by: StatField; by2?: StatField | undefined },
    ): Promise<ReportStats> {
      const sql = requireDatabase(deps);
      const project = await resolveProject(sql, ref);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(project.id));
      // The same field twice is a one-field table with a diagonal; drawn as one field instead.
      const by2 = query.by2 && query.by2 !== query.by ? query.by2 : null;
      const [issueIds, byValues, by2Values] = await Promise.all([
        loadStatIssues(sql, project.id),
        loadFieldValues(sql, project.id, query.by),
        by2 ? loadFieldValues(sql, project.id, by2) : null,
      ]);
      const result = fieldStats({
        issueIds,
        by: query.by,
        byValues,
        by2: by2 && by2Values ? { field: by2, values: by2Values } : undefined,
      });
      return { by: query.by, by2, ...result, total: issueIds.length };
    },
  };
}

export type StatsService = ReturnType<typeof createStatsService>;
