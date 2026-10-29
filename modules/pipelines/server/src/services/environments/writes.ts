import type { RequestContext, SqlClient, SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type { z } from 'zod';
import type {
  createEnvironmentBodySchema,
  setPathBodySchema,
  updateEnvironmentBodySchema,
} from '../../../../shared/environment-writes.ts';
import {
  environmentProtectionSchema,
  type Environment,
  type EnvironmentPath,
} from '../../../../shared/environments.ts';
import type { Tier } from '../../../../shared/common.ts';
import { personOf, requireAccess, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import { openFrontDoor } from '../front-doors/index.ts';
import { selectEnvironments } from './read.ts';
import { selectPath } from './paths.ts';

/*
 * Environments a platform admin creates, edits and archives, and the path each tier's releases
 * take through them (journeys proposal: "Environments and targets you can create"). Before
 * this, only the demo seed wrote either, so a fresh install had nothing to promote to.
 */

type CreateEnvironment = z.infer<typeof createEnvironmentBodySchema>;
type UpdateEnvironment = z.infer<typeof updateEnvironmentBodySchema>;
type SetPath = z.infer<typeof setPathBodySchema>;

const OPEN_PROMOTIONS = ['requested', 'gating', 'awaiting_approval', 'scheduled', 'rolling_out'];

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';

/** The account must be one Pipelines can deploy into on the environment's own cloud. */
async function checkAccount(sql: SqlExecutor, accountId: string | null, provider: string) {
  if (!accountId) return;
  const [account] = await sql<{ provider: string; status: string; external_id: string }[]>`
    select c.provider, a.status, a.external_id
    from cloud_accounts a join cloud_connections c on c.id = a.connection_id
    where a.id = ${accountId}`;
  if (!account) throw new NotFoundError('No cloud account has that id');
  if (account.provider !== provider) {
    throw new ValidationError(`${account.external_id} is on ${account.provider}, not ${provider}`);
  }
  if (account.status === 'failed') {
    throw new ValidationError(
      `${account.external_id} failed its last check. Fix what it found, check it again, then choose it`,
    );
  }
}

async function requireEnvironment(sql: SqlExecutor, key: string) {
  const [row] = await sql<{ id: string; provider: string; protection: Record<string, unknown> }[]>`
    select id, provider, protection from pipeline_environments
    where key = ${key} and archived_at is null`;
  if (!row) throw new NotFoundError(`No environment is called ${key}`);
  return row;
}

async function one(sql: SqlExecutor, key: string): Promise<Environment> {
  const [environment] = await selectEnvironments(sql, key);
  if (!environment) throw new NotFoundError(`No environment is called ${key}`);
  return environment;
}

export function createEnvironmentWrites(deps: PipelinesServiceDeps) {
  const authorizeAdmin = (ctx: RequestContext) =>
    requireAccess(deps).authorizeAction(ctx, 'platform', { scope: { kind: 'organisation' } });
  const sql = (): SqlClient => requireDatabase(deps);

  return {
    async create(ctx: RequestContext, body: CreateEnvironment): Promise<Environment> {
      await authorizeAdmin(ctx);
      const db = sql();
      await checkAccount(db, body.cloudAccountId, body.provider);
      const protection = environmentProtectionSchema.parse({
        protected: body.class === 'prod',
        requiresApproval: body.class === 'prod',
        ...body.protection,
      });
      try {
        await db`
          insert into pipeline_environments
            (key, name, class, provider, cloud_account_id, region, position, protection,
             default_runtime)
          values (${body.key}, ${body.name}, ${body.class}, ${body.provider},
            ${body.cloudAccountId}, ${body.region},
            coalesce(${body.position ?? null}::int,
              (select coalesce(max(position) + 1, 0) from pipeline_environments
               where archived_at is null)),
            ${JSON.stringify(protection)}::jsonb, ${body.defaultRuntime ?? 'cloud-run'})`;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictError(`An environment called ${body.key} exists already`);
        }
        throw error;
      }
      const created = await one(db, body.key);
      // Prod moves between runtimes with no downtime from its first day.
      if (body.class === 'prod') await openFrontDoor(db, created.id, personOf(ctx.actor));
      return created;
    },

    async update(ctx: RequestContext, key: string, body: UpdateEnvironment): Promise<Environment> {
      await authorizeAdmin(ctx);
      const db = sql();
      const current = await requireEnvironment(db, key);
      if (body.cloudAccountId !== undefined) {
        await checkAccount(db, body.cloudAccountId, current.provider);
      }
      const protection = body.protection
        ? environmentProtectionSchema.parse({ ...current.protection, ...body.protection })
        : null;
      await db.begin(async (tx) => {
        await tx`
          update pipeline_environments set
            name = coalesce(${body.name ?? null}, name),
            class = coalesce(${body.class ?? null}, class),
            region = case when ${body.region !== undefined} then ${body.region ?? null} else region end,
            position = coalesce(${body.position ?? null}::int, position),
            cloud_account_id = case when ${body.cloudAccountId !== undefined}
              then ${body.cloudAccountId ?? null}::uuid else cloud_account_id end,
            protection = coalesce(${protection ? JSON.stringify(protection) : null}::jsonb, protection),
            default_runtime = coalesce(${body.defaultRuntime ?? null}, default_runtime),
            updated_at = now()
          where id = ${current.id}`;
        // A project chosen here wins over one the landing zone mapped for every domain.
        if (body.cloudAccountId !== undefined) {
          await tx`
            delete from pipeline_environment_accounts
            where environment_id = ${current.id} and domain_id is null`;
        }
      });
      return one(db, key);
    },

    async archive(ctx: RequestContext, key: string): Promise<void> {
      await authorizeAdmin(ctx);
      const db = sql();
      const current = await requireEnvironment(db, key);
      const [open] = await db<{ count: number }[]>`
        select count(*)::int as count from pipeline_promotions
        where environment_id = ${current.id} and state = any(${OPEN_PROMOTIONS}::text[])`;
      if ((open?.count ?? 0) > 0) {
        throw new ConflictError(
          `${open?.count} promotions to ${key} are still open. Let them finish or cancel them first`,
        );
      }
      await db.begin(async (tx) => {
        await tx`delete from pipeline_environment_path_steps where environment_id = ${current.id}`;
        await tx`
          update pipeline_environments set archived_at = now(), updated_at = now()
          where id = ${current.id}`;
      });
    },

    async setPath(ctx: RequestContext, tier: Tier, body: SetPath): Promise<EnvironmentPath> {
      await authorizeAdmin(ctx);
      const db = sql();
      const ids = body.steps.map((step) => step.environmentId);
      const [found] = await db<{ count: number }[]>`
        select count(*)::int as count from pipeline_environments
        where id = any(${ids}::uuid[]) and archived_at is null`;
      if ((found?.count ?? 0) !== ids.length) {
        throw new ValidationError('Every step must be an environment that exists');
      }
      await db.begin(async (tx) => {
        const [path] = await tx<{ id: string }[]>`
          insert into pipeline_environment_paths (tier, name)
          values (${tier}, ${body.name ?? `Tier ${tier}`})
          on conflict (tier) do update
            set name = coalesce(${body.name ?? null}, pipeline_environment_paths.name),
              updated_at = now()
          returning id`;
        if (!path) throw new Error('upsert returned nothing');
        await tx`delete from pipeline_environment_path_steps where path_id = ${path.id}`;
        for (const step of body.steps) {
          await tx`
            insert into pipeline_environment_path_steps
              (path_id, environment_id, stage, bake_minutes, auto_promote)
            values (${path.id}, ${step.environmentId}, ${step.stage}, ${step.bakeMinutes},
              ${step.autoPromote})`;
        }
      });
      const path = await selectPath(db, tier);
      if (!path) throw new Error('the path just written is missing');
      return path;
    },
  };
}
