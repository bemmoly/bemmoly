import type { SqlClient } from '@bemmoly/core';
import { ProviderError, ValidationError } from '@bemmoly/shared';
import type { Provider } from '../../../../shared/common.ts';
import type { ConnectionRecord, SecretsPart } from '../providers/contract.ts';
import { requireConnection, toRecord } from '../clouds/store.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { resolveTarget } from '../shipping/targets.ts';

/*
 * Where a secret's value lives. A secret for one environment lives in that environment's own
 * project, so Prod's values never leave Prod's project. CI secrets, and secrets set for every
 * environment, live in one shared project: a managed connection's CI project, or the attached
 * project an admin chose for them on the connection.
 */

export interface SecretHome {
  connection: ConnectionRecord;
  secrets: SecretsPart;
  /** The cloud account's id in Pipelines. */
  accountId: string;
  /** Its id in the cloud: the Google Cloud project id. */
  account: string;
}

export const registryOf = async (providers: ProviderSourceOrRegistry) =>
  typeof providers === 'function' ? providers() : providers;

/** The secrets part of the provider behind a connection, or why there is none. */
export async function secretsFor(
  providers: ProviderSourceOrRegistry,
  provider: Provider,
): Promise<{ part: SecretsPart; name: string }> {
  const found = (await registryOf(providers)).get(provider);
  if (!found.secrets) {
    throw new ValidationError(
      `${found.name} cannot store secrets yet. Set a plain variable instead, or deploy to Google Cloud`,
    );
  }
  return { part: found.secrets, name: found.name };
}

export async function environmentHome(
  sql: SqlClient,
  providers: ProviderSourceOrRegistry,
  applicationId: string,
  environmentId: string,
): Promise<SecretHome> {
  const { provider, target } = await resolveTarget(sql, providers, applicationId, environmentId);
  if (!target.account) {
    throw new ValidationError(
      `${target.environment.key} has no project yet. Choose one in Platform › Environments, then set the secret again`,
    );
  }
  const { part } = await secretsFor(providers, provider.id);
  const [account] = await sql<{ id: string }[]>`
    select id from cloud_accounts
    where connection_id = ${target.connection.id} and external_id = ${target.account.externalId}`;
  if (!account) throw new ValidationError(`${target.account.externalId} is no longer attached`);
  return {
    connection: target.connection,
    secrets: part,
    accountId: account.id,
    account: target.account.externalId,
  };
}

export async function sharedHome(
  sql: SqlClient,
  providers: ProviderSourceOrRegistry,
): Promise<SecretHome> {
  const rows = await sql<
    { account_id: string; external_id: string; connection_id: string; provider: Provider }[]
  >`
    select a.id as account_id, a.external_id, c.id as connection_id, c.provider
    from cloud_accounts a join cloud_connections c on c.id = a.connection_id
    where c.config ->> 'ciAccountId' = a.id::text
      or (a.purpose = 'ci' and coalesce(c.config ->> 'mode', 'managed') = 'managed')
    order by (c.config ->> 'ciAccountId' = a.id::text) desc, c.created_at, a.created_at`;
  const registry = await registryOf(providers);
  for (const row of rows) {
    const secrets = registry.list().find((provider) => provider.id === row.provider)?.secrets;
    if (!secrets) continue;
    return {
      connection: toRecord(await requireConnection(sql, row.connection_id)),
      secrets,
      accountId: row.account_id,
      account: row.external_id,
    };
  }
  throw new ValidationError(
    'No project holds CI secrets yet. In Platform › Clouds, choose one on your Google Cloud connection',
  );
}

/** A recorded secret's account and connection, for reading it back or mounting it. */
export async function homeOf(
  sql: SqlClient,
  providers: ProviderSourceOrRegistry,
  accountId: string | null,
): Promise<SecretHome> {
  const [row] = accountId
    ? await sql<{ external_id: string; connection_id: string; provider: Provider }[]>`
        select a.external_id, a.connection_id, c.provider
        from cloud_accounts a join cloud_connections c on c.id = a.connection_id
        where a.id = ${accountId}`
    : [];
  if (!row || !accountId) {
    throw new ValidationError('The project this secret lived in is gone. Set the secret again');
  }
  const { part } = await secretsFor(providers, row.provider);
  return {
    connection: toRecord(await requireConnection(sql, row.connection_id)),
    secrets: part,
    accountId,
    account: row.external_id,
  };
}

/**
 * "bemmoly-checkout-api-STRIPE_KEY-prod". Keys are lowercase and names are capitals, so two
 * applications or environments never land on one name. Secret Manager allows 255 characters.
 */
export function secretIdOf(application: string, environment: string | null, name: string): string {
  const id = ['bemmoly', application, name, ...(environment ? [environment] : [])].join('-');
  if (id.length > 255) {
    throw new ValidationError(`${name} is too long to store as a secret here; use a shorter name`);
  }
  return id;
}

/** The store's version as Pipelines records it; Secret Manager numbers versions 1, 2, 3. */
export function storedVersion(version: string): number {
  const number = Number(version);
  if (!Number.isInteger(number) || number < 1) {
    throw new ProviderError(
      `The secret store answered version "${version}", which is not a number`,
    );
  }
  return number;
}
