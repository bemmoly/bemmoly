import type { RequestContext, SqlClient } from '@bemmoly/core';
import type { ChangesResponse } from '../../../../shared/changes.ts';
import type { CurrentQuery, CurrentResponse } from '../../../../shared/deployments.ts';
import { authorizePipelines, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { listChanges, toChangeItem, windowOf, type ParsedChangesQuery } from './changes.ts';
import { currentAt, currentNow, toCurrent } from './current.ts';
import { scopeErrorSeries } from './series.ts';
import { takeSnapshot } from './snapshots.ts';

export {
  currentAt,
  currentNow,
  toCurrent,
  type CurrentAtRow,
  type CurrentFilter,
} from './current.ts';
export { recordChange, type ChangeInput } from './record.ts';
export { riseOf } from './series.ts';

/*
 * History (architecture §18): what runs where now or at any moment, and what changed in a
 * scope and window. The Release map, the application page and For you read the same
 * current-state functions this service exports.
 */

export interface HistoryDeps extends PipelinesServiceDeps {
  providers?: ProviderSourceOrRegistry;
  now?: () => Date;
}

const filterOf = (scope: string | undefined): { domain: string | null; group: string | null } => {
  const [domain, group] = (scope ?? '').split('/');
  return { domain: domain || null, group: group || null };
};

export function createHistoryService(deps: HistoryDeps) {
  const sql = (): SqlClient => requireDatabase(deps);
  const now = deps.now ?? (() => new Date());
  return {
    async current(ctx: RequestContext, query: CurrentQuery): Promise<CurrentResponse> {
      await authorizePipelines(ctx);
      const filter = {
        ...filterOf(query.scope),
        application: query.application ?? null,
        environment: query.environment ?? null,
      };
      const rows = query.at
        ? await currentAt(sql(), filter, new Date(query.at))
        : await currentNow(sql(), filter);
      return { at: query.at ?? null, items: rows.map(toCurrent) };
    },

    async changes(ctx: RequestContext, parsed: ParsedChangesQuery): Promise<ChangesResponse> {
      await authorizePipelines(ctx);
      const { from, to } = windowOf(parsed, now());
      const { domain, group } = filterOf(parsed.scope);
      const label = `Error rate, ${parsed.scope ? `applications in ${parsed.scope}` : 'every application'} in Prod`;
      const series = deps.providers
        ? await scopeErrorSeries(sql(), deps.providers, { domain, group, from, to, label })
        : { label, source: 'unavailable' as const, points: [], riseAt: null };
      const rows = await listChanges(sql(), {
        domain,
        group,
        from,
        to,
        kinds: parsed.kinds,
        prodOnly: parsed.prodOnly ?? false,
        includeCallersOf: parsed.includeCallersOf,
      });
      const items = rows.map((row) => toChangeItem(row, series));
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        items,
        counts: {
          total: items.length,
          prod: items.filter((item) => item.environment?.class === 'prod').length,
        },
        series,
      };
    },

    /** The hourly job: one snapshot of pipeline_current, and the old ones dropped. */
    snapshot: (keepDays: number) => takeSnapshot(sql(), now(), keepDays),
  };
}

export type HistoryService = ReturnType<typeof createHistoryService>;
