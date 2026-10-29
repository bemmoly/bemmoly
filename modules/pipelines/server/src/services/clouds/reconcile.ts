import type { SqlClient } from '@bemmoly/core';
import { ProviderError, ValidationError } from '@bemmoly/shared';
import type { CloudResourceKind, Layout } from '../../../../shared/clouds.ts';
import {
  ApplyStopped,
  type CloudProvider,
  type DesiredResource,
  type LandingZonePart,
} from '../providers/contract.ts';
import type { ProviderRegistry } from '../providers/registry.ts';
import { resourceHash, type DesiredAccount } from './layout.ts';
import { inDependencyOrder, keyOf } from './order.ts';
import {
  listResourceRows,
  mapEnvironment,
  markResource,
  rollUpAccounts,
  type ResourceStatus,
  upsertAccount,
  upsertResource,
} from './records.ts';
import {
  findPlan,
  listConnections,
  recordBoundary,
  requireConnection,
  setPlanStatus,
  setConfigValue,
  toRecord,
} from './store.ts';

/*
 * The read, diff, apply, verify loop (architecture §14). Resources go in dependency order;
 * one whose recorded hash matches and is ready is skipped, so a retried job only redoes what
 * failed. Something already matching in the cloud is adopted without an apply. A failure
 * stops only what depends on it, and the job fails at the end so the queue retries it. A
 * provider that says going on cannot help (ApplyStopped: the billing account is full) stops
 * the whole apply there; what was not reached waits, and Retry starts from it.
 */

export interface ReconcileDeps {
  database: SqlClient;
  providers: () => Promise<ProviderRegistry>;
}

/** What a plan stores: the declaration Apply works through. */
export interface StoredZone {
  layout: Layout;
  /** The environments the preview was limited to; absent for all of them. */
  environmentKeys?: string[];
  folderName: string;
  accounts: DesiredAccount[];
  resources: DesiredResource[];
}

export interface ApplyOutcome {
  applied: number;
  skipped: number;
  failed: string[];
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function landingZoneOf(provider: CloudProvider): LandingZonePart {
  if (!provider.landingZone) {
    throw new ValidationError(`${provider.name} landing zones are coming soon`);
  }
  return provider.landingZone;
}

export async function applyPlan(deps: ReconcileDeps, planId: string): Promise<ApplyOutcome> {
  const sql = deps.database;
  const plan = await findPlan(sql, planId);
  if (!plan || plan.status === 'applied' || plan.status === 'superseded') {
    return { applied: 0, skipped: 0, failed: [] };
  }
  const row = await requireConnection(sql, plan.connection_id);
  const provider = (await deps.providers()).get(row.provider as CloudProvider['id']);
  const zone = landingZoneOf(provider);
  const stored = plan.desired as StoredZone;
  const connection = toRecord(row);
  if (!connection.boundaryRef && provider.org) {
    const { ref } = await provider.org.ensureBoundary(connection, stored.folderName);
    await recordBoundary(sql, row.id, ref);
    connection.boundaryRef = ref;
  }

  const accountIds = new Map<string, string>();
  for (const account of stored.accounts) {
    accountIds.set(account.externalId, await upsertAccount(sql, row.id, account));
  }

  const outcome: ApplyOutcome = { applied: 0, skipped: 0, failed: [] };
  const unfinished = new Set<string>();
  let stopped: string | null = null;
  for (const resource of inDependencyOrder(stored.resources)) {
    const key = keyOf(resource);
    const accountId = accountIds.get(resource.account);
    if (!accountId) throw new Error(`${key} names an account the plan does not declare`);
    const recorded = await upsertResource(sql, accountId, resource);
    const waitingOn = resource.dependsOn.find((dependency) => unfinished.has(dependency));
    if (stopped || waitingOn) {
      unfinished.add(key);
      if (recorded.status === 'ready' && recorded.specHash === resourceHash(resource)) continue;
      await markResource(sql, recorded.id, {
        status: 'pending',
        error: stopped ? `Stopped: ${stopped}` : `Waiting for ${waitingOn}`,
      });
      continue;
    }
    const hash = resourceHash(resource);
    if (recorded.status === 'ready' && recorded.specHash === hash) {
      outcome.skipped += 1;
      continue;
    }
    await markResource(sql, recorded.id, { status: 'applying' });
    try {
      let observed = await zone.read(connection, resource);
      if (!observed || zone.diff(resource, observed).length > 0) {
        observed = await zone.apply(connection, resource);
      }
      const problems = zone.diff(resource, observed);
      if (problems.length > 0) throw new Error(`Still differs after apply: ${problems.join('; ')}`);
      await markResource(sql, recorded.id, { status: 'ready', observed, specHash: hash });
      if (resource.kind === 'account') {
        const account = stored.accounts.find((entry) => entry.externalId === resource.account);
        if (account) await mapEnvironment(sql, stored.layout, account, accountId);
      }
      await nameRegistry(sql, row, resource, observed);
      outcome.applied += 1;
    } catch (error) {
      unfinished.add(key);
      outcome.failed.push(key);
      if (error instanceof ApplyStopped) stopped = error.message;
      await markResource(sql, recorded.id, { status: 'failed', error: message(error) });
    }
  }
  await rollUpAccounts(sql, row.id);
  if (outcome.failed.length > 0) {
    const summary =
      stopped ?? `${outcome.failed.length} resources failed, first ${outcome.failed[0]}`;
    await setPlanStatus(sql, plan.id, 'failed', summary);
    throw new ProviderError(summary, { details: { failed: outcome.failed } });
  }
  await setPlanStatus(sql, plan.id, 'applied');
  return outcome;
}

/**
 * Once the shared registry exists, runners push there: the connection names it unless a
 * person already chose a registry.
 */
async function nameRegistry(
  sql: SqlClient,
  row: { id: string; config: Record<string, unknown> },
  resource: DesiredResource,
  observed: Record<string, unknown>,
): Promise<void> {
  const location = observed['location'];
  if (resource.kind !== 'registry_access' || resource.spec['access'] !== 'push') return;
  if (typeof location !== 'string' || row.config['registry']) return;
  await setConfigValue(sql, row.id, 'registry', location);
  row.config = { ...row.config, registry: location };
}

export interface DriftOutcome {
  checked: number;
  drifted: number;
  unreadable: number;
}

/** Re-reads every settled resource and marks those that no longer match as drifted. */
export async function scanDrift(deps: ReconcileDeps): Promise<DriftOutcome> {
  const sql = deps.database;
  const registry = await deps.providers();
  const outcome: DriftOutcome = { checked: 0, drifted: 0, unreadable: 0 };
  for (const row of await listConnections(sql)) {
    if (row.status !== 'connected') continue;
    const provider = registry.list().find((candidate) => candidate.id === row.provider);
    if (!provider?.landingZone) continue;
    const connection = toRecord(row);
    const resources = [
      ...(await listResourceRows(sql, row.id, 'ready')),
      ...(await listResourceRows(sql, row.id, 'drifted')),
    ];
    for (const resource of resources) {
      const desired: DesiredResource = {
        kind: resource.kind as CloudResourceKind,
        name: resource.name,
        account: resource.account_external_id,
        spec: resource.desired,
        dependsOn: [],
      };
      outcome.checked += 1;
      try {
        const observed = await provider.landingZone.read(connection, desired);
        const problems = observed
          ? provider.landingZone.diff(desired, observed)
          : ['It no longer exists'];
        if (problems.length > 0) outcome.drifted += 1;
        await markResource(sql, resource.id, {
          status: problems.length > 0 ? 'drifted' : 'ready',
          observed,
          error: problems.length > 0 ? problems.join('; ') : null,
        });
      } catch (error) {
        // An unreadable resource is not evidence of drift: its status stays, the reason is
        // kept for the screen, and the next scan tries again.
        outcome.unreadable += 1;
        await markResource(sql, resource.id, {
          status: resource.status as ResourceStatus,
          error: `Could not read it: ${message(error)}`,
        });
      }
    }
    await rollUpAccounts(sql, row.id);
  }
  return outcome;
}
