import type { RequestContext, SqlClient } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { SetVariableBody, Variable } from '../../../../shared/variables.ts';
import type { AccessEngine } from '../access/engine.ts';
import { requirePerson } from '../deps.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { environmentHome, secretIdOf, sharedHome, storedVersion } from './home.ts';
import { selectVariables } from './read.ts';
import { checkReferences } from './references.ts';

/*
 * Setting and deleting one variable. A secret's value goes to the store in the same request
 * and no further: it is not written here, logged, or put in an event, and the answer carries
 * only its version. A value for every environment also reaches each protected environment
 * that has none of its own, so it must pass that environment's protection too.
 */

export interface VariableWritesDeps {
  sql: SqlClient;
  access: AccessEngine;
  providers: ProviderSourceOrRegistry;
}

export interface VariableTarget {
  application: { id: string; key: string };
  environment: { id: string; key: string } | null;
  name: string;
}

async function authorizeChange(deps: VariableWritesDeps, ctx: RequestContext, at: VariableTarget) {
  const application = at.application.id;
  if (at.environment) {
    await deps.access.authorizeAction(ctx, 'change_variables', {
      application,
      environment: at.environment.id,
    });
    return;
  }
  await deps.access.authorizeAction(ctx, 'change_variables', { application });
  const reached = await deps.sql<{ id: string }[]>`
    select e.id from pipeline_environments e
    where e.archived_at is null
      and coalesce((e.protection ->> 'protected')::boolean, e.class = 'prod')
      and not exists (select 1 from pipeline_variables v
        where v.application_id = ${application} and v.environment_id = e.id
          and v.name = ${at.name})
    order by e.position, e.id`;
  for (const environment of reached) {
    await deps.access.authorizeAction(ctx, 'change_variables', {
      application,
      environment: environment.id,
    });
  }
}

async function one(sql: SqlClient, at: VariableTarget): Promise<Variable> {
  const found = await selectVariables(sql, at.application.id, {
    name: at.name,
    ...(at.environment ? { environment: at.environment.key } : {}),
  });
  const match = found.find(
    (item) => (item.environment?.id ?? null) === (at.environment?.id ?? null),
  );
  if (!match) throw new Error('the variable just written is missing');
  return match;
}

export function createVariableWrites(deps: VariableWritesDeps) {
  const { sql } = deps;

  async function upsert(
    at: VariableTarget,
    by: string,
    row:
      | { kind: 'plain'; value: string }
      | { kind: 'secret'; ref: string; accountId: string; version: number },
  ) {
    const plain = row.kind === 'plain';
    await sql`
      insert into pipeline_variables
        (application_id, environment_id, name, kind, value, secret_ref, secret_account_id,
         version, problem, updated_by)
      values (${at.application.id}, ${at.environment?.id ?? null}, ${at.name}, ${row.kind},
        ${plain ? row.value : null}, ${plain ? null : row.ref},
        ${plain ? null : row.accountId}, ${plain ? 1 : row.version}, null, ${by})
      on conflict (application_id, environment_id, name) do update set
        kind = excluded.kind, value = excluded.value, secret_ref = excluded.secret_ref,
        secret_account_id = excluded.secret_account_id,
        version = case when excluded.kind = 'plain' and pipeline_variables.kind = 'plain'
          then pipeline_variables.version + 1 else excluded.version end,
        problem = null, updated_by = excluded.updated_by, updated_at = now()`;
  }

  return {
    async set(ctx: RequestContext, at: VariableTarget, body: SetVariableBody): Promise<Variable> {
      await authorizeChange(deps, ctx, at);
      const by = requirePerson(ctx.actor);
      if (body.kind === 'plain') {
        await checkReferences(sql, body.value);
        await upsert(at, by, { kind: 'plain', value: body.value });
        return one(sql, at);
      }
      const home = at.environment
        ? await environmentHome(sql, deps.providers, at.application.id, at.environment.id)
        : await sharedHome(sql, deps.providers);
      const ref = secretIdOf(at.application.key, at.environment?.key ?? null, at.name);
      const { version } = await home.secrets.writeVersion(home.connection, {
        account: home.account,
        name: ref,
        value: body.value,
      });
      await upsert(at, by, {
        kind: 'secret',
        ref,
        accountId: home.accountId,
        version: storedVersion(version),
      });
      return one(sql, at);
    },

    /**
     * Forgets the variable. A secret stays in the store: revisions still running read it when
     * they start an instance, and a roll back may need it again.
     */
    async remove(ctx: RequestContext, at: VariableTarget): Promise<void> {
      await authorizeChange(deps, ctx, at);
      const removed = await sql`
        delete from pipeline_variables
        where application_id = ${at.application.id} and name = ${at.name}
          and environment_id is not distinct from ${at.environment?.id ?? null}::uuid
        returning id`;
      if (removed.length === 0) {
        throw new NotFoundError(
          `${at.application.key} has no ${at.name} for ${at.environment?.key ?? 'every environment'}`,
        );
      }
    },
  };
}
