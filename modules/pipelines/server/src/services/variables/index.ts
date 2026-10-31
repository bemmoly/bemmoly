import type { RequestContext, SqlClient } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { SetVariableBody, Variable, VariablesResponse } from '../../../../shared/variables.ts';
import {
  authorizePipelines,
  personOf,
  requireAccess,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { loadApplication } from '../shipping/load.ts';
import { ciSecretValues } from './ci.ts';
import { variablesForDeploy } from './deploy.ts';
import { moveUnmovedSecrets } from './move.ts';
import { selectEnvironmentRefs, selectVariables } from './read.ts';
import { withResolved } from './references.ts';
import { createVariableWrites, type VariableTarget } from './writes.ts';

export const MOVE_SECRETS_JOB = 'pipelines.variables-move';

/** An application's variables and secrets: list, set, delete, and what deploys and CI read. */
export function createVariablesService(
  deps: PipelinesServiceDeps & { providers: ProviderSourceOrRegistry },
) {
  const sql = (): SqlClient => requireDatabase(deps);
  const writes = () =>
    createVariableWrites({ sql: sql(), access: requireAccess(deps), providers: deps.providers });

  async function environmentOf(key: string) {
    const [row] = await sql()<{ id: string; key: string }[]>`
      select id, key from pipeline_environments where key = ${key} and archived_at is null`;
    if (!row) throw new NotFoundError(`No environment is called ${key}`);
    return row;
  }

  // The product gate comes first, so someone outside Pipelines cannot tell which names exist.
  async function targetOf(
    ctx: RequestContext,
    application: string,
    environment: string | undefined,
    name: string,
  ) {
    await authorizePipelines(ctx);
    const app = await loadApplication(sql(), { key: application });
    return {
      application: { id: app.id, key: app.key },
      environment: environment ? await environmentOf(environment) : null,
      name,
    } satisfies VariableTarget;
  }

  return {
    async list(
      ctx: RequestContext,
      application: string,
      query: { environment?: string },
    ): Promise<VariablesResponse> {
      await authorizePipelines(ctx);
      const app = await loadApplication(sql(), { key: application });
      const access = requireAccess(deps);
      await access.authorizeAction(ctx, 'view', { application: app.id });
      if (query.environment) await environmentOf(query.environment);
      const person = personOf(ctx.actor);
      const canChange = person
        ? (await access.decideFor(ctx, person, 'change_variables', { application: app.id })).allowed
        : true;
      const environments = await selectEnvironmentRefs(sql(), query.environment);
      const items = await selectVariables(sql(), app.id, query);
      return { items: await withResolved(sql(), items, environments), environments, canChange };
    },

    async set(
      ctx: RequestContext,
      at: { application: string; environment?: string; name: string },
      body: SetVariableBody,
    ): Promise<Variable> {
      return writes().set(ctx, await targetOf(ctx, at.application, at.environment, at.name), body);
    },

    async remove(
      ctx: RequestContext,
      at: { application: string; environment?: string; name: string },
    ): Promise<void> {
      await writes().remove(ctx, await targetOf(ctx, at.application, at.environment, at.name));
    },

    /** The sweep job: values from before secrets existed, into the store. */
    moveUnmoved: () => moveUnmovedSecrets(sql(), deps.providers),

    forDeploy: (applicationId: string, environmentId: string) =>
      variablesForDeploy(sql(), deps.providers, applicationId, environmentId),

    ciValues: (applicationId: string, names: readonly string[]) =>
      ciSecretValues(sql(), deps.providers, applicationId, names),
  };
}

export type VariablesService = ReturnType<typeof createVariablesService>;
