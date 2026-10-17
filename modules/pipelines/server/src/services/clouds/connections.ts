import type { RequestContext, SqlClient } from '@bemmoly/core';
import { ConflictError, ValidationError } from '@bemmoly/shared';
import type { z } from 'zod';
import type {
  CloudConnection,
  connectCloudBodySchema,
  connectionsResponseSchema,
  providersResponseSchema,
} from '../../../../shared/clouds.ts';
import type { Provider } from '../../../../shared/common.ts';
import { authorizePipelines, personOf } from '../deps.ts';
import { partAvailability, type CloudProvider } from '../providers/contract.ts';
import type { ProviderRegistry } from '../providers/registry.ts';
import { toConnection } from './present.ts';
import {
  insertConnection,
  listConnections,
  recordCheck,
  requireConnection,
  toRecord,
} from './store.ts';

/*
 * Connections: which clouds are offered, connecting one and checking it. Connecting stores
 * only config (organization, billing account, folder name); identity is keyless, so there is
 * no secret to hold. The local provider's connections are config only too.
 */

export type ConnectCloud = z.infer<typeof connectCloudBodySchema>;
type ProvidersResponse = z.infer<typeof providersResponseSchema>;
type ConnectionsResponse = z.infer<typeof connectionsResponseSchema>;

export interface ConnectionsDeps {
  sql: () => SqlClient;
  providers: () => Promise<ProviderRegistry>;
  authorizeAdmin: (ctx: RequestContext) => Promise<void>;
}

/** The provider behind a connection, or a sentence saying it is not available. */
export async function providerFor(
  providers: () => Promise<ProviderRegistry>,
  id: Provider,
): Promise<CloudProvider> {
  const found = (await providers()).list().find((provider) => provider.id === id);
  if (!found) throw new ValidationError(`The ${id} provider is not installed`);
  return found;
}

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';

export function createConnections(deps: ConnectionsDeps) {
  return {
    async providers(ctx: RequestContext): Promise<ProvidersResponse> {
      await authorizePipelines(ctx);
      return { items: (await deps.providers()).info() };
    },

    async list(ctx: RequestContext): Promise<ConnectionsResponse> {
      await authorizePipelines(ctx);
      return { items: (await listConnections(deps.sql())).map(toConnection) };
    },

    async connect(ctx: RequestContext, body: ConnectCloud): Promise<CloudConnection> {
      await deps.authorizeAdmin(ctx);
      if (body.provider !== 'local') {
        const provider = await providerFor(deps.providers, body.provider);
        if (partAvailability(provider, 'connection') !== 'available') {
          throw new ValidationError(`${provider.name} is coming soon`);
        }
      }
      try {
        return toConnection(await insertConnection(deps.sql(), body, personOf(ctx.actor)));
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictError(
            `A connection named ${body.name} exists already; choose another name`,
          );
        }
        throw error;
      }
    },

    async check(ctx: RequestContext, id: string): Promise<CloudConnection> {
      await deps.authorizeAdmin(ctx);
      const sql = deps.sql();
      const row = await requireConnection(sql, id);
      const provider = await providerFor(deps.providers, row.provider as Provider);
      if (!provider.connection) throw new ValidationError(`${provider.name} is coming soon`);
      const check = await provider.connection.verify(toRecord(row));
      return toConnection(await recordCheck(sql, id, check));
    },
  };
}
