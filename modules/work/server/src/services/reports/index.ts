import type { RequestContext } from '@bemmoly/core';
import type { ControlChart, ScopeReport, TimeInStatus } from '../../../../shared/reports.ts';
import { projectStatuses, resolveProject, type PlanningDeps } from '../boards/context.ts';
import { projectResource, requireDatabase } from '../issues/deps.ts';
import { utcDate } from '../metrics/burndown.ts';
import { statusSets } from '../metrics/load.ts';
import { cycleStats } from './control.ts';
import { loadControlPoints, loadScopeHistory, loadScopeTargets, loadStays } from './load.ts';
import { scopeWeeks, weekCutoffs } from './scope.ts';
import { statusStays } from './time-in-status.ts';

/*
 * The Reports screen's second tier: the control chart, time in status and
 * the epic and version burnups. Like the sprint reports, each is rebuilt
 * from issue_history on read and nothing is stored.
 */

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

/** The window as instants: from the start of the first day to now. */
function dayWindow(now: number, days: number) {
  const today = Date.parse(`${utcDate(now)}T00:00:00.000Z`);
  const start = today - (days - 1) * DAY;
  return { start, end: now, from: utcDate(start), to: utcDate(now) };
}

export function createReportsService(deps: Pick<PlanningDeps, 'database' | 'now'>) {
  const now = () => (deps.now?.() ?? new Date()).getTime();

  async function project(ctx: RequestContext, ref: string) {
    const sql = requireDatabase(deps);
    const resolved = await resolveProject(sql, ref);
    await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(resolved.id));
    return { sql, project: resolved, sets: await statusSets(sql, resolved.id, null) };
  }

  return {
    async control(
      ctx: RequestContext,
      ref: string,
      query: { days: number },
    ): Promise<ControlChart> {
      const { sql, project: target, sets } = await project(ctx, ref);
      const range = dayWindow(now(), query.days);
      const points = await loadControlPoints(sql, target.id, sets, range.start, range.end);
      return { from: range.from, to: range.to, points, ...cycleStats(points) };
    },

    async timeInStatus(
      ctx: RequestContext,
      ref: string,
      query: { days: number },
    ): Promise<TimeInStatus> {
      const { sql, project: target } = await project(ctx, ref);
      const range = dayWindow(now(), query.days);
      const [statuses, history] = await Promise.all([
        projectStatuses(sql, target.id),
        loadStays(sql, target.id, range.start, range.end),
      ]);
      const stays = statusStays(history.issues, history.moves, range.start, range.end);
      return {
        from: range.from,
        to: range.to,
        statuses: statuses.flatMap((status) => {
          const stay = stays.get(status.id);
          if (!stay) return [];
          return [
            {
              statusId: status.id,
              name: status.name,
              category: status.category,
              averageDays: Math.round((stay.totalMs / stay.issues / DAY) * 10) / 10,
              issues: stay.issues,
            },
          ];
        }),
      };
    },

    async scope(
      ctx: RequestContext,
      ref: string,
      query: { kind: 'epic' | 'version'; id?: string | undefined; weeks: number },
    ): Promise<ScopeReport> {
      const { sql, project: target, sets } = await project(ctx, ref);
      const targets = await loadScopeTargets(sql, target.id, query.kind, sets);
      const chosen = targets.find((item) => item.id === query.id) ?? targets[0] ?? null;
      if (!chosen) return { kind: query.kind, targets, target: null, weeks: [] };
      const at = now();
      const start = (weekCutoffs(at, query.weeks)[0] ?? at) - WEEK;
      const history = await loadScopeHistory(sql, query.kind, chosen.id, start);
      const weeks = scopeWeeks({
        targetId: chosen.id,
        ...history,
        done: sets.done,
        now: at,
        weeks: query.weeks,
      });
      return { kind: query.kind, targets, target: chosen, weeks };
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;
