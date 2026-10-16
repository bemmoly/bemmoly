import type { Actor, RequestContext, SqlClient } from '@bemmoly/core';
import type { CapabilityName } from '@bemmoly/shared';
import { ProviderError, ValidationError } from '@bemmoly/shared';

/** What every Pipelines service is built from; the database is absent only without one. */
export interface PipelinesServiceDeps {
  database?: SqlClient;
}

export function requireDatabase(deps: PipelinesServiceDeps): SqlClient {
  if (!deps.database) throw new ProviderError('Pipelines needs the database');
  return deps.database;
}

/** The product-level resource: module access first, then the capability's role row. */
export const PIPELINES_RESOURCE = { kind: 'workspace', moduleId: 'pipelines' } as const;

export async function authorizePipelines(
  ctx: RequestContext,
  capability: CapabilityName = 'pipelines.view',
): Promise<void> {
  await ctx.authz.authorize(ctx.actor, capability, PIPELINES_RESOURCE);
}

/** The person behind the actor: a person, or whoever a token or a plan acts for. */
export function personOf(actor: Actor): string | null {
  if (actor.kind === 'user') return actor.id;
  return actor.userId ?? null;
}

export function requirePerson(actor: Actor): string {
  const person = personOf(actor);
  if (!person) throw new ValidationError('This needs a person, not a system actor');
  return person;
}
