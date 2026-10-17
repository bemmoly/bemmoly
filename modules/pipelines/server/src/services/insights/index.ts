import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import type { z } from 'zod';
import type { Insights, insightsQuerySchema } from '../../../../shared/insights.ts';
import { authorizePipelines, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import { resolveScope } from '../overview/index.ts';
import { readMeasures, type ScopeFilter, type Window } from './measures.ts';
import { levelFor, readRows } from './rows.ts';

const DAYS = { '30d': 30, '90d': 90, '180d': 180 } as const;
const DAY_MS = 86_400_000;

const isoDate = (at: Date) => at.toISOString().slice(0, 10);

/**
 * The range ends today; the range before it is the same number of days just before. Rates
 * per day divide by the days that have history, so a young install is not averaged down.
 */
export function windowOf(
  range: keyof typeof DAYS,
  historyStart: Date | null,
  now = new Date(),
): Window {
  const days = DAYS[range];
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const from = today - (days - 1) * DAY_MS;
  const previousFrom = today - (2 * days - 1) * DAY_MS;
  const start = historyStart ? historyStart.getTime() : today;
  const span = (first: number, last: number) =>
    Math.max(1, Math.round((last - Math.max(first, start)) / DAY_MS) + 1);
  return {
    days: span(from, today),
    previousDays: span(previousFrom, from - DAY_MS),
    from: isoDate(new Date(from)),
    previousFrom: isoDate(new Date(previousFrom)),
  };
}

async function historyStart(sql: SqlExecutor): Promise<Date | null> {
  const [row] = await sql<{ day: string | null }[]>`
    select min(day)::text as day from pipeline_daily_rollups`;
  return row?.day ? new Date(`${row.day}T00:00:00Z`) : null;
}

function scopeFilter(
  sql: SqlExecutor,
  scope: Awaited<ReturnType<typeof resolveScope>>,
): ScopeFilter {
  return (column) => {
    if (scope.group) {
      return sql`${sql.unsafe(column)} in (
        select id from pipeline_applications where group_id = ${scope.group.id}::uuid)`;
    }
    if (scope.domain) {
      return sql`${sql.unsafe(column)} in (
        select id from pipeline_applications where domain_id = ${scope.domain.id}::uuid)`;
    }
    return sql`true`;
  };
}

/** Insights: how fast and how safely a scope delivers, from the daily rollups. */
export function createInsightsService(deps: PipelinesServiceDeps) {
  return {
    async get(
      ctx: RequestContext,
      { range, by, scope: path }: z.output<typeof insightsQuerySchema>,
    ): Promise<Insights> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const [scope, start] = await Promise.all([resolveScope(sql, path), historyStart(sql)]);
      const window = windowOf(range, start);
      const inScope = scopeFilter(sql, scope);
      const [measures, rows] = await Promise.all([
        readMeasures(sql, window, inScope),
        readRows(sql, window, levelFor(by, scope), inScope),
      ]);
      return {
        range,
        from: new Date(`${window.from}T00:00:00Z`).toISOString(),
        to: new Date().toISOString(),
        measures,
        by,
        rows,
      };
    },
  };
}

export type InsightsService = ReturnType<typeof createInsightsService>;
