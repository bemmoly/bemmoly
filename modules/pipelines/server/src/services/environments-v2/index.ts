import type { RequestContext } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { z } from 'zod';
import type {
  AppliedSuggestedSetup,
  applySuggestedSetupBodySchema,
  createEnvironmentV2BodySchema,
  EnvironmentsV2Response,
  EnvironmentV2View,
  ReorderEnvironmentsBody,
  updateEnvironmentV2BodySchema,
} from '../../../../shared/environments-v2.ts';
import {
  authorizePipelines,
  personOf,
  requireAccess,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';
import { selectEnvironmentsV2 } from './read.ts';
import { applySuggested } from './suggested.ts';
import {
  insertEnvironment,
  removeEnvironment,
  reorderEnvironments,
  updateEnvironment,
} from './writes.ts';

/*
 * Environments, simply (product rule 3): equal environments on one ordered path. Everyone in
 * Pipelines reads them; only a Platform admin creates, changes, removes or reorders them, and
 * every write is one transaction so the path never shows half a change.
 */

type CreateBody = z.infer<typeof createEnvironmentV2BodySchema>;
type UpdateBody = z.infer<typeof updateEnvironmentV2BodySchema>;
type SuggestedBody = z.infer<typeof applySuggestedSetupBodySchema>;

export function createEnvironmentsV2Service(deps: PipelinesServiceDeps) {
  const sql = () => requireDatabase(deps);
  const authorizeAdmin = (ctx: RequestContext) =>
    requireAccess(deps).authorizeAction(ctx, 'platform', { scope: { kind: 'organisation' } });

  async function one(key: string): Promise<EnvironmentV2View> {
    const [environment] = await selectEnvironmentsV2(sql(), key);
    if (!environment) throw new NotFoundError(`No environment has the ID ${key}`);
    return environment;
  }

  return {
    async list(ctx: RequestContext): Promise<EnvironmentsV2Response> {
      await authorizePipelines(ctx);
      return { items: await selectEnvironmentsV2(sql()) };
    },

    async create(ctx: RequestContext, body: CreateBody): Promise<EnvironmentV2View> {
      await authorizeAdmin(ctx);
      await sql().begin((tx) => insertEnvironment(tx, body));
      return one(body.key);
    },

    async update(ctx: RequestContext, key: string, body: UpdateBody): Promise<EnvironmentV2View> {
      await authorizeAdmin(ctx);
      const next = await sql().begin((tx) => updateEnvironment(tx, key, body));
      return one(next);
    },

    async remove(ctx: RequestContext, key: string): Promise<void> {
      await authorizeAdmin(ctx);
      await sql().begin((tx) => removeEnvironment(tx, key));
    },

    async reorder(
      ctx: RequestContext,
      body: ReorderEnvironmentsBody,
    ): Promise<EnvironmentsV2Response> {
      await authorizeAdmin(ctx);
      await sql().begin((tx) => reorderEnvironments(tx, body));
      return { items: await selectEnvironmentsV2(sql()) };
    },

    async applySuggested(ctx: RequestContext, body: SuggestedBody): Promise<AppliedSuggestedSetup> {
      await authorizeAdmin(ctx);
      const groups = await sql().begin((tx) => applySuggested(tx, body, personOf(ctx.actor)));
      return { items: await selectEnvironmentsV2(sql()), groups };
    },
  };
}

export type EnvironmentsV2Service = ReturnType<typeof createEnvironmentsV2Service>;
