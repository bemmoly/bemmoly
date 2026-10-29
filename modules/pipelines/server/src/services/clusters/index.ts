import type { RequestContext } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { z } from 'zod';
import type {
  attachClusterBodySchema,
  Cluster,
  clusterBodySchema,
  ClustersResponse,
  createClusterBodySchema,
} from '../../../../shared/clusters.ts';
import type { Provider } from '../../../../shared/common.ts';
import type { ClusterRow } from '../../models/clusters.ts';
import { providerFor } from '../clouds/connections.ts';
import {
  authorizePipelines,
  personOf,
  requireAccess,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';
import type { ClustersPart } from '../providers/contract.ts';
import type { ProviderSource } from '../providers/index.ts';
import { accountFor, clusterRecordOf, connectionRecordOf, toCluster } from './present.ts';
import {
  applicationsOnCluster,
  deleteCluster,
  insertCluster,
  listClusters,
  recordClusterCheck,
  requireCluster,
  requireEnvironmentPlace,
} from './store.ts';

/*
 * Platform › Clusters: one cluster per environment, made only when an application there runs
 * on GKE. A managed connection creates it in the environment's project and region; an
 * attached connection attaches one that exists and is only ever deployed into. GKE takes
 * minutes to create a cluster, so a created one shows "creating" and each read of the list
 * asks GKE how it is getting on. Reads need Pipelines; writes are a platform admin's.
 */

type CreateBody = z.infer<typeof createClusterBodySchema>;
type AttachBody = z.infer<typeof attachClusterBodySchema>;

export interface ClustersServiceDeps extends PipelinesServiceDeps {
  providers: ProviderSource;
}

const reasonOf = (error: unknown) => (error as Error).message;

export function createClustersService(deps: ClustersServiceDeps) {
  const sql = () => requireDatabase(deps);
  const authorizeAdmin = (ctx: RequestContext) =>
    requireAccess(deps).authorizeAction(ctx, 'platform', { scope: { kind: 'organisation' } });

  async function partFor(row: Pick<ClusterRow, 'connection_provider'>): Promise<ClustersPart> {
    const provider = await providerFor(deps.providers, row.connection_provider as Provider);
    if (!provider.clusters) throw new ValidationError(`${provider.name} cannot run clusters yet`);
    return provider.clusters;
  }

  /** Follows a cluster being created, then checks it can take deploys; records what it found. */
  async function refresh(row: ClusterRow): Promise<void> {
    const part = await partFor(row);
    const connection = connectionRecordOf(row);
    const record = clusterRecordOf(row);
    if (row.origin === 'created' && row.status === 'creating') {
      const state = await part.read(connection, record);
      if (state.status === 'creating') {
        await recordClusterCheck(sql(), row.id, { ...state, status: 'creating', problems: [] });
        return;
      }
      if (state.status !== 'ready') {
        const problem = state.message ?? `GKE could not create ${row.name}`;
        await recordClusterCheck(sql(), row.id, {
          ...state,
          status: 'failed',
          problems: [problem],
        });
        return;
      }
    }
    const check = await part.verify(connection, record, accountFor(row));
    await recordClusterCheck(sql(), row.id, {
      status: check.ok ? 'ready' : 'failed',
      problems: check.problems,
      mode: check.mode,
      releaseChannel: check.releaseChannel,
    });
  }

  async function create(ctx: RequestContext, body: CreateBody): Promise<string> {
    const place = await requireEnvironmentPlace(sql(), body.environmentId);
    if (place.connection_config?.['mode'] === 'attached') {
      throw new ValidationError(
        `${place.connection_name} deploys into projects you already have. Attach ${place.key}'s cluster instead`,
      );
    }
    const config = place.connection_config ?? {};
    const location =
      place.region ?? (typeof config['region'] === 'string' ? config['region'] : 'us-central1');
    const name = body.name ?? `bemmoly-${place.key}`.slice(0, 40).replace(/-+$/, '');
    const id = await insertCluster(sql(), {
      connectionId: place.connection_id ?? '',
      environmentId: place.id,
      environmentKey: place.key,
      origin: 'created',
      mode: body.mode,
      projectId: place.account_external_id ?? '',
      location,
      name,
      gateway: null,
      createdBy: personOf(ctx.actor),
    });
    const row = await requireCluster(sql(), id);
    try {
      await (
        await partFor(row)
      ).create(connectionRecordOf(row), {
        projectId: row.project_id,
        location,
        name,
        mode: body.mode,
        labels: { 'managed-by': 'bemmoly', environment: place.key },
        account: place.account_config,
      });
    } catch (error) {
      // Kept as the cluster's own state, so the screen says what to fix and Check again retries.
      await recordClusterCheck(sql(), id, {
        status: 'failed',
        problems: [`GKE did not start creating ${name}. ${reasonOf(error)}`],
        mode: null,
        releaseChannel: null,
      });
    }
    return id;
  }

  async function attach(ctx: RequestContext, body: AttachBody): Promise<string> {
    const place = await requireEnvironmentPlace(sql(), body.environmentId);
    if (place.connection_config?.['mode'] !== 'attached') {
      throw new ValidationError(
        `${place.connection_name} creates its own clusters. Create ${place.key}'s cluster instead`,
      );
    }
    const id = await insertCluster(sql(), {
      connectionId: place.connection_id ?? '',
      environmentId: place.id,
      environmentKey: place.key,
      origin: 'attached',
      mode: 'autopilot',
      projectId: body.projectId,
      location: body.location,
      name: body.name,
      gateway: body.gateway,
      createdBy: personOf(ctx.actor),
    });
    await refresh(await requireCluster(sql(), id));
    return id;
  }

  return {
    async list(ctx: RequestContext): Promise<ClustersResponse> {
      await authorizePipelines(ctx);
      const rows = await listClusters(sql());
      const creating = rows.filter((row) => row.origin === 'created' && row.status === 'creating');
      if (creating.length === 0) return { items: rows.map(toCluster) };
      for (const row of creating) {
        try {
          await refresh(row);
        } catch (error) {
          // One cluster GKE cannot answer for stays "creating" and says why; the list still loads.
          await recordClusterCheck(sql(), row.id, {
            status: 'creating',
            problems: [`Bemmoly could not ask GKE about ${row.name}. ${reasonOf(error)}`],
            mode: null,
            releaseChannel: null,
          });
        }
      }
      return { items: (await listClusters(sql())).map(toCluster) };
    },

    async add(ctx: RequestContext, body: z.infer<typeof clusterBodySchema>): Promise<Cluster> {
      await authorizeAdmin(ctx);
      const id = body.origin === 'created' ? await create(ctx, body) : await attach(ctx, body);
      return toCluster(await requireCluster(sql(), id));
    },

    async check(ctx: RequestContext, id: string): Promise<Cluster> {
      await authorizeAdmin(ctx);
      await refresh(await requireCluster(sql(), id));
      return toCluster(await requireCluster(sql(), id));
    },

    async remove(ctx: RequestContext, id: string): Promise<void> {
      await authorizeAdmin(ctx);
      const row = await requireCluster(sql(), id);
      if (row.origin === 'created' && row.status !== 'failed') {
        throw new ValidationError(
          `Pipelines runs ${row.name}; it stays while ${row.environment_key} may run applications on GKE`,
        );
      }
      const using = await applicationsOnCluster(sql(), row.environment_id);
      if (using.length > 0) {
        throw new ValidationError(
          `${using.join(', ')} ${using.length === 1 ? 'runs' : 'run'} on GKE in ${row.environment_key}. Switch ${using.length === 1 ? 'it' : 'them'} to Cloud Run first`,
        );
      }
      await deleteCluster(sql(), id);
    },
  };
}

export type ClustersService = ReturnType<typeof createClustersService>;
