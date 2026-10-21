import type { RequestContext, SqlClient, SqlFragment } from '@bemmoly/core';
import { sortRuleQuery, type BacklogSortRule } from '../../../../shared/boards.ts';
import type { LqlService } from '../lql/index.ts';

/*
 * A list's order and filter, compiled from LQL: the board's sort rules first, a match rule as
 * "matching issues above the rest", a field rule as that field's ORDER BY, then the query's
 * own ORDER BY. Rank breaks every tie after them, so with no rules and no ORDER BY the lists
 * stay in the order planning ranked them. The backlog and the board share it.
 */

export interface ListOrder {
  /** The query's WHERE, or null when there is none. */
  filter: SqlFragment | null;
  /** ORDER BY keys with their directions, before rank. Empty keeps rank order. */
  keys: SqlFragment[];
}

export async function compileListOrder(
  sql: SqlClient,
  lql: LqlService,
  ctx: RequestContext,
  projectId: string,
  rules: readonly BacklogSortRule[],
  q: string | undefined,
): Promise<ListOrder> {
  const text = q?.trim() ?? '';
  if (rules.length === 0 && text === '') return { filter: null, keys: [] };
  const catalog = await lql.catalog(projectId);
  const keys = rules.flatMap((rule): SqlFragment[] => {
    if (rule.kind === 'field') return lql.order(lql.parse(sortRuleQuery(rule), catalog), catalog);
    const condition = lql.where(ctx, lql.parse(rule.query, catalog), catalog);
    return [sql`case when (${condition}) then 0 else 1 end asc`];
  });
  if (text === '') return { filter: null, keys };
  const query = lql.parse(text, catalog);
  return {
    filter: query.where ? lql.where(ctx, query, catalog) : null,
    keys: [...keys, ...lql.order(query, catalog)],
  };
}

/** The keys as one ORDER BY list ending in rank and the id tiebreak. */
export function orderWithRank(sql: SqlClient, keys: readonly SqlFragment[]): SqlFragment {
  return [...keys, sql`issues.rank collate "C" asc`, sql`issues.id asc`].reduce(
    (acc, key) => sql`${acc}, ${key}`,
  );
}
