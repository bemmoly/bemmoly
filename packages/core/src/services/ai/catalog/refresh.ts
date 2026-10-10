import type { CatalogData } from '@bemmoly/shared';
import type { JobQueue } from '../../../contracts/jobs.ts';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import { listRoles, markDeprecated } from '../store/roles.ts';
import { isDeprecated, successorOf } from './overrides.ts';
import type { CatalogResolver } from './resolver.ts';

export const AI_CATALOG_REFRESH_JOB = 'ai.catalog.refresh';
/** Daily at 04:17 UTC: off the hour so installs do not all ask models.dev at once. */
export const AI_CATALOG_REFRESH_SCHEDULE = '17 4 * * *';

export interface DeprecationFlag {
  role: string;
  model: string;
  successor: string | null;
}

/** Marks configured models the catalog now calls deprecated, with the family's successor. */
export async function flagDeprecatedRoles(
  sql: SqlExecutor,
  data: CatalogData,
): Promise<DeprecationFlag[]> {
  const flagged: DeprecationFlag[] = [];
  for (const row of await listRoles(sql)) {
    const provider = data[row.catalogId];
    const model = provider?.models[row.model];
    if (!provider || !model || !isDeprecated(model)) continue;
    const successor = successorOf(provider, model);
    await markDeprecated(sql, row.role, successor);
    flagged.push({ role: row.role, model: row.model, successor });
  }
  return flagged;
}

/**
 * The background warmer: refreshes the snapshot even when nobody opens the picker, then flags
 * deprecated configured models. With the live fetch off it only re-checks deprecation. With AI
 * off it does nothing at all, so an install that never turns AI on never calls out for it; the
 * Settings › AI and setup pickers still resolve the catalog when they open.
 */
export function registerCatalogRefresh(
  jobs: JobQueue,
  deps: {
    sql: SqlExecutor;
    catalog: CatalogResolver;
    /** The workspace's AI switch, read when the job runs. */
    aiEnabled: () => Promise<boolean>;
    onFlagged?: (flags: DeprecationFlag[]) => Promise<void>;
  },
): void {
  jobs.register(
    AI_CATALOG_REFRESH_JOB,
    async () => {
      if (!(await deps.aiEnabled())) return;
      const resolved = await deps.catalog.resolve({ force: true });
      const flags = await flagDeprecatedRoles(deps.sql, resolved.data);
      if (flags.length) await deps.onFlagged?.(flags);
    },
    { schedule: AI_CATALOG_REFRESH_SCHEDULE, retryLimit: 2 },
  );
}
