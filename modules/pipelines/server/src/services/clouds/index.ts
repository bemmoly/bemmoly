import type { RequestContext } from '@bemmoly/core';
import { requireAccess, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import type { ProviderSource } from '../providers/index.ts';
import type { ProviderRegistry } from '../providers/registry.ts';
import { createAttachedAccounts } from './attached.ts';
import { createConnections } from './connections.ts';
import { applyPlan, scanDrift } from './reconcile.ts';
import { createZones, type SendJob } from './zones.ts';

/*
 * Platform › Clouds (architecture §14): connections, the landing zone preview and apply, and
 * what was made. Reads need Pipelines; every write is a platform admin's, checked through the
 * access engine at the organisation scope.
 */

export { LANDING_ZONE_APPLY_JOB } from './zones.ts';
export const LANDING_ZONE_DRIFT_JOB = 'pipelines.landing-zone-drift';

export interface CloudsServiceDeps extends PipelinesServiceDeps {
  /** A fixed registry (tests) or a source that follows the simulate setting. */
  providers: ProviderRegistry | ProviderSource;
  sendJob?: SendJob;
}

export function createCloudsService(deps: CloudsServiceDeps) {
  const source = deps.providers;
  const providers: ProviderSource = typeof source === 'function' ? source : async () => source;
  const sql = () => requireDatabase(deps);
  const authorizeAdmin = async (ctx: RequestContext) => {
    await requireAccess(deps).authorizeAction(ctx, 'platform', { scope: { kind: 'organisation' } });
  };
  const shared = { sql, providers, authorizeAdmin };
  return {
    ...createConnections(shared),
    ...createAttachedAccounts(shared),
    ...createZones({ ...shared, ...(deps.sendJob ? { sendJob: deps.sendJob } : {}) }),
    /** The apply job's work: authorization was checked when it was queued. */
    runApply: (planId: string) => applyPlan({ database: sql(), providers }, planId),
    /** The nightly drift scan's work. */
    scanDrift: () => scanDrift({ database: sql(), providers }),
  };
}

export type CloudsService = ReturnType<typeof createCloudsService>;
