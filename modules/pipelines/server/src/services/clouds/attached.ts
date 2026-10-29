import type { RequestContext } from '@bemmoly/core';
import { ConflictError, ValidationError } from '@bemmoly/shared';
import type { z } from 'zod';
import type {
  attachAccountBodySchema,
  UpdateConnectionBody,
} from '../../../../shared/cloud-accounts.ts';
import type { CloudAccount, CloudConnection } from '../../../../shared/clouds.ts';
import type { Provider } from '../../../../shared/common.ts';
import type { ConnectionRow } from '../../models/clouds.ts';
import {
  deleteAccount,
  environmentsUsing,
  recordAccountCheck,
  requireAccount,
  upsertAttached,
} from './accounts.ts';
import { providerFor, type ConnectionsDeps } from './connections.ts';
import { toAccount, toConnection } from './present.ts';
import { requireConnection, setRegistry, toRecord } from './store.ts';

/*
 * Attached mode (journeys proposal): projects that exist already are attached to a connection,
 * checked as the identity Pipelines will deploy as, and then chosen by environments like any
 * created project. Attaching never changes the project; it only records what was found.
 */

type AttachAccount = z.infer<typeof attachAccountBodySchema>;

function requireAttached(row: ConnectionRow): void {
  if (row.config['mode'] !== 'attached') {
    throw new ValidationError(
      `${row.name} creates its own projects. Plan its landing zone instead, or connect Google Cloud again with projects you already have`,
    );
  }
}

export function createAttachedAccounts(deps: ConnectionsDeps) {
  async function check(row: ConnectionRow, accountId: string, adoptName: boolean) {
    const sql = deps.sql();
    const account = await requireAccount(sql, row.id, accountId);
    const provider = await providerFor(deps.providers, row.provider as Provider);
    if (!provider.connection?.verifyAccount) {
      throw new ValidationError(`${provider.name} cannot attach existing accounts yet`);
    }
    const result = await provider.connection.verifyAccount(toRecord(row), {
      externalId: account.external_id,
      config: account.config,
    });
    await recordAccountCheck(sql, accountId, result, adoptName);
    return toAccount(await requireAccount(sql, row.id, accountId));
  }

  return {
    async attach(ctx: RequestContext, id: string, body: AttachAccount): Promise<CloudAccount> {
      await deps.authorizeAdmin(ctx);
      const row = await requireConnection(deps.sql(), id);
      requireAttached(row);
      const accountId = await upsertAttached(deps.sql(), row.id, {
        externalId: body.externalId,
        name: body.name ?? body.externalId,
        config: {
          deployerServiceAccount: body.deployerServiceAccount,
          runtimeServiceAccount: body.runtimeServiceAccount,
        },
      });
      return check(row, accountId, !body.name);
    },

    async recheck(ctx: RequestContext, id: string, accountId: string): Promise<CloudAccount> {
      await deps.authorizeAdmin(ctx);
      const row = await requireConnection(deps.sql(), id);
      return check(row, accountId, false);
    },

    async detach(ctx: RequestContext, id: string, accountId: string): Promise<void> {
      await deps.authorizeAdmin(ctx);
      const sql = deps.sql();
      const account = await requireAccount(sql, id, accountId);
      if (account.origin !== 'attached') {
        throw new ValidationError(
          'Pipelines created this project; it stays until its landing zone is changed',
        );
      }
      const using = await environmentsUsing(sql, accountId);
      if (using.length > 0) {
        throw new ConflictError(
          `${using.join(', ')} still ${using.length === 1 ? 'deploys' : 'deploy'} into ${account.external_id}. Point ${using.length === 1 ? 'it' : 'them'} at another project first`,
        );
      }
      await deleteAccount(sql, accountId);
    },

    async update(
      ctx: RequestContext,
      id: string,
      body: UpdateConnectionBody,
    ): Promise<CloudConnection> {
      await deps.authorizeAdmin(ctx);
      return toConnection(await setRegistry(deps.sql(), id, body.registry));
    },
  };
}
