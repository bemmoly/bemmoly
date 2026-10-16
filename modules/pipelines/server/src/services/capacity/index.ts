import type { RequestContext } from '@bemmoly/core';
import { ConflictError, NotFoundError } from '@bemmoly/shared';
import type {
  Capacity,
  CapacityQuery,
  CreatedPool,
  CreatePoolBody,
  PoolToken,
  RunnerPool,
  TeamShareBody,
  UpdatePoolBody,
} from '../../../../shared/capacity.ts';
import { createPoolBodySchema } from '../../../../shared/capacity.ts';
import { topicOf } from '../../../../shared/streams.ts';
import {
  authorizePipelines,
  requireAccess,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';
import { publishStreamEvent } from '../streams/publish.ts';
import { hashToken, newToken } from '../../utils/tokens.ts';
import { readPools } from './pools.ts';
import { readCapacity } from './read.ts';

/*
 * Runner pools and fair share (architecture §5, §6, Platform › Capacity). Reading is for
 * anyone in Pipelines; changing pools, tokens and weights is platform work. A pool's token is
 * shown once, on create and on rotate, and only its hash is kept.
 */

export function createCapacityService(deps: PipelinesServiceDeps) {
  const platform = (ctx: RequestContext) => requireAccess(deps).authorizeAction(ctx, 'platform');

  async function onePool(key: string): Promise<RunnerPool> {
    const [pool] = await readPools(requireDatabase(deps), key);
    if (!pool) throw new NotFoundError(`There is no runner pool called ${key}`);
    return pool;
  }

  return {
    async read(ctx: RequestContext, query: CapacityQuery): Promise<Capacity> {
      await authorizePipelines(ctx);
      return readCapacity(requireDatabase(deps), query);
    },

    async pools(ctx: RequestContext): Promise<{ items: RunnerPool[] }> {
      await authorizePipelines(ctx);
      return { items: await readPools(requireDatabase(deps)) };
    },

    async create(ctx: RequestContext, input: CreatePoolBody): Promise<CreatedPool> {
      await platform(ctx);
      const body = createPoolBodySchema.parse(input);
      const sql = requireDatabase(deps);
      const token = newToken('pool');
      const [row] = await sql<{ token_rotated_at: Date }[]>`
        insert into pipeline_runner_pools (key, name, hosting, location, labels, min_runners,
          max_runners, warm_runners, cloud_account_id, token_hash, token_rotated_at)
        values (${body.key}, ${body.name}, ${body.hosting}, ${body.location ?? null},
          ${body.labels}::text[], ${body.minRunners}, ${body.maxRunners}, ${body.warmRunners},
          ${body.cloudAccount ?? null}::uuid, ${hashToken(token)}, now())
        on conflict (key) do nothing
        returning token_rotated_at`;
      if (!row) throw new ConflictError(`A pool called ${body.key} already exists`);
      return {
        pool: await onePool(body.key),
        token: { token, rotatedAt: new Date(row.token_rotated_at).toISOString() },
      };
    },

    async update(ctx: RequestContext, key: string, body: UpdatePoolBody): Promise<RunnerPool> {
      await platform(ctx);
      const sql = requireDatabase(deps);
      const updated = await sql`
        update pipeline_runner_pools set
          name = coalesce(${body.name ?? null}, name),
          location = coalesce(${body.location ?? null}, location),
          labels = coalesce(${body.labels ?? null}::text[], labels),
          min_runners = coalesce(${body.minRunners ?? null}, min_runners),
          max_runners = coalesce(${body.maxRunners ?? null}, max_runners),
          warm_runners = coalesce(${body.warmRunners ?? null}, warm_runners),
          updated_at = now()
        where key = ${key} returning id`;
      if (updated.length === 0) throw new NotFoundError(`There is no runner pool called ${key}`);
      return onePool(key);
    },

    /** A new registration token; runners already registered keep working. */
    async rotateToken(ctx: RequestContext, key: string): Promise<PoolToken> {
      await platform(ctx);
      const token = newToken('pool');
      const [row] = await requireDatabase(deps)<{ token_rotated_at: Date }[]>`
        update pipeline_runner_pools set token_hash = ${hashToken(token)}, token_rotated_at = now(),
          updated_at = now()
        where key = ${key} returning token_rotated_at`;
      if (!row) throw new NotFoundError(`There is no runner pool called ${key}`);
      return { token, rotatedAt: new Date(row.token_rotated_at).toISOString() };
    },

    async setShare(ctx: RequestContext, key: string, teamId: string, body: TeamShareBody) {
      await platform(ctx);
      const sql = requireDatabase(deps);
      await sql.begin(async (tx) => {
        const [pool] = await tx<
          { id: string }[]
        >`select id from pipeline_runner_pools where key = ${key}`;
        if (!pool) throw new NotFoundError(`There is no runner pool called ${key}`);
        await tx`
          insert into pipeline_team_shares (pool_id, team_id, weight)
          values (${pool.id}, ${teamId}, ${body.weight})
          on conflict (pool_id, team_id) do update set weight = excluded.weight, updated_at = now()`;
        await publishStreamEvent(tx, {
          topic: topicOf.capacity(),
          kind: 'capacity.updated',
          data: {},
        });
      });
      return { team: teamId, weight: body.weight };
    },
  };
}

export type CapacityService = ReturnType<typeof createCapacityService>;
