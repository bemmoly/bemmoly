import type { RequestContext, SendJobOptions, SqlClient } from '@bemmoly/core';
import { ConflictError, NotFoundError, ProviderError, ValidationError } from '@bemmoly/shared';
import type { z } from 'zod';
import type {
  ApplyLandingZoneBody,
  cloudAccountsResponseSchema,
  cloudResourcesResponseSchema,
  LandingZonePlan,
  LandingZonePlanBody,
  Layout,
} from '../../../../shared/clouds.ts';
import type { Provider } from '../../../../shared/common.ts';
import type { ConnectionRow } from '../../models/clouds.ts';
import { authorizePipelines, personOf } from '../deps.ts';
import type { CloudProvider } from '../providers/contract.ts';
import type { ProviderRegistry } from '../providers/registry.ts';
import { providerFor } from './connections.ts';
import { buildZone, type DesiredZone } from './layout.ts';
import { toAccount, toPlan, toResource } from './present.ts';
import type { StoredZone } from './reconcile.ts';
import { listAccountRows, listResourceRows } from './records.ts';
import {
  findPlan,
  insertPlan,
  recordedResources,
  requireConnection,
  startApplying,
  supersedeOtherPlans,
  toRecord,
  zoneInput,
} from './store.ts';
import { previewTree, statusOf, type RecordedResource } from './tree.ts';

/*
 * Plan and apply. A plan is built from what Pipelines recorded, so previewing never touches
 * the cloud except to ask about quota. Apply checks the hash the person saw against both the
 * plan and a fresh declaration, then queues one job keyed by plan, hash and attempt.
 */

export const LANDING_ZONE_APPLY_JOB = 'pipelines.landing-zone-apply';

export type SendJob = (
  name: string,
  payload: Record<string, unknown>,
  options?: SendJobOptions,
) => Promise<unknown>;

export interface ZonesDeps {
  sql: () => SqlClient;
  providers: () => Promise<ProviderRegistry>;
  sendJob?: SendJob;
  authorizeAdmin: (ctx: RequestContext) => Promise<void>;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function blockersFor(
  provider: CloudProvider,
  row: ConnectionRow,
  zone: DesiredZone,
  recorded: ReadonlyMap<string, RecordedResource>,
): Promise<string[]> {
  if (!provider.landingZone) return [`${provider.name} landing zones are coming soon`];
  if (row.config['mode'] === 'attached') {
    return [
      `${row.name} uses projects you already have, so it creates none. Attach projects to it instead, or connect Google Cloud again to let Pipelines create them`,
    ];
  }
  const blockers: string[] = [];
  if (row.status !== 'connected') {
    blockers.push(
      `Check the connection first. ${row.last_error ?? 'It has not been checked yet.'}`,
    );
  }
  if (!zone.accounts.some((account) => account.purpose === 'workload')) {
    blockers.push(`Add an environment on ${provider.name} before planning its landing zone`);
  }
  const creating = zone.resources.filter(
    (resource) =>
      resource.kind === 'account' &&
      statusOf(resource, recorded) === 'create' &&
      zone.accounts.find((account) => account.externalId === resource.account)?.purpose !==
        'control',
  ).length;
  if (provider.org && row.status === 'connected' && creating > 0) {
    try {
      blockers.push(...(await provider.org.checkQuota(toRecord(row), creating)));
    } catch (error) {
      blockers.push(
        `Bemmoly could not check the quota for ${creating} new accounts. ${message(error)}`,
      );
    }
  }
  return blockers;
}

const stored = (zone: DesiredZone, environmentKeys: string[] | undefined): StoredZone => ({
  layout: zone.layout,
  folderName: zone.folderName,
  accounts: zone.accounts,
  resources: zone.resources,
  ...(environmentKeys ? { environmentKeys } : {}),
});

export function createZones(deps: ZonesDeps) {
  async function declare(row: ConnectionRow, layout: Layout, environmentKeys?: string[]) {
    return buildZone(await zoneInput(deps.sql(), row, layout, environmentKeys));
  }

  return {
    async plan(
      ctx: RequestContext,
      id: string,
      body: LandingZonePlanBody,
    ): Promise<LandingZonePlan> {
      await deps.authorizeAdmin(ctx);
      const sql = deps.sql();
      const row = await requireConnection(sql, id);
      const provider = await providerFor(deps.providers, row.provider as Provider);
      const zone = await declare(row, body.layout ?? (row.layout as Layout), body.environments);
      const recorded = await recordedResources(sql, row.id);
      const { root, counts } = previewTree(zone, Boolean(row.boundary_ref), recorded);
      const plan = await insertPlan(sql, {
        connection_id: row.id,
        layout: zone.layout,
        spec_hash: zone.hash,
        desired: stored(zone, body.environments),
        tree: root,
        counts,
        blockers: await blockersFor(provider, row, zone, recorded),
        createdBy: personOf(ctx.actor),
      });
      return toPlan(plan);
    },

    async apply(
      ctx: RequestContext,
      id: string,
      body: ApplyLandingZoneBody,
    ): Promise<LandingZonePlan> {
      await deps.authorizeAdmin(ctx);
      const sql = deps.sql();
      const plan = await findPlan(sql, body.planId);
      if (!plan || plan.connection_id !== id)
        throw new NotFoundError('No landing zone plan has that id');
      if (plan.spec_hash !== body.specHash) {
        throw new ConflictError('This plan is not the one you previewed. Preview it again');
      }
      if (plan.status === 'superseded') {
        throw new ConflictError('A newer preview replaced this one. Apply that one instead');
      }
      if (plan.status === 'applied' || plan.status === 'applying') return toPlan(plan);
      const [blocker] = plan.blockers;
      if (blocker) throw new ValidationError(blocker);
      const row = await requireConnection(sql, id);
      const saved = plan.desired as StoredZone;
      const now = await declare(row, plan.layout as Layout, saved.environmentKeys);
      if (now.hash !== plan.spec_hash) {
        throw new ConflictError(
          'Environments, the catalog or the connection changed since this preview. Preview it again',
        );
      }
      if (!deps.sendJob) throw new ProviderError('Applying a landing zone needs the job queue');
      const attempt = await startApplying(sql, plan);
      await supersedeOtherPlans(sql, id, plan.id);
      await deps.sendJob(
        LANDING_ZONE_APPLY_JOB,
        { planId: plan.id },
        {
          idempotencyKey: `${LANDING_ZONE_APPLY_JOB}:${plan.id}:${plan.spec_hash}:${attempt}`,
          ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
        },
      );
      return toPlan(plan);
    },

    async accounts(
      ctx: RequestContext,
      id: string,
    ): Promise<z.infer<typeof cloudAccountsResponseSchema>> {
      await authorizePipelines(ctx);
      const sql = deps.sql();
      await requireConnection(sql, id);
      return { items: (await listAccountRows(sql, id)).map(toAccount) };
    },

    async resources(
      ctx: RequestContext,
      id: string,
    ): Promise<z.infer<typeof cloudResourcesResponseSchema>> {
      await authorizePipelines(ctx);
      const sql = deps.sql();
      await requireConnection(sql, id);
      return { items: (await listResourceRows(sql, id)).map(toResource) };
    },
  };
}
