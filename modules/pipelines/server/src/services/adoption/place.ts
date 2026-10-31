import type { SqlClient } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import type { EnvironmentClass, Provider } from '../../../../shared/common.ts';
import type { EnvironmentRef } from '../../../../shared/environments.ts';
import { requireConnection, toRecord } from '../clouds/store.ts';
import type { AdoptPart, ConnectionRecord, ServicePlace } from '../providers/contract.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { registryOf } from '../variables/home.ts';

/*
 * Where an environment's services run: its own project, the connection that project belongs
 * to, the region, and the provider part that reads what runs there.
 */

export interface EnvironmentPlace {
  environment: EnvironmentRef & { protected: boolean; defaultRuntime: string };
  connection: ConnectionRecord;
  adopt: AdoptPart;
  place: ServicePlace;
  /** The project's id in Pipelines. */
  accountId: string;
}

interface PlaceRow {
  id: string;
  key: string;
  name: string;
  class: string;
  provider: Provider;
  region: string | null;
  default_runtime: string;
  protected: boolean;
  account_id: string | null;
  external_id: string | null;
  account_config: Record<string, unknown> | null;
  connection_id: string | null;
}

export async function loadEnvironmentPlace(
  sql: SqlClient,
  providers: ProviderSourceOrRegistry,
  key: string,
): Promise<EnvironmentPlace> {
  const [row] = await sql<PlaceRow[]>`
    select e.id, e.key, e.name, e.class, e.provider, e.region, e.default_runtime,
      coalesce((e.protection ->> 'protected')::boolean, e.class = 'prod') as protected,
      a.id as account_id, a.external_id, a.config as account_config,
      a.connection_id
    from pipeline_environments e
    left join cloud_accounts a on a.id = e.cloud_account_id
    where e.key = ${key} and e.archived_at is null`;
  if (!row) throw new NotFoundError(`No environment is called ${key}`);
  if (!row.account_id || !row.external_id || !row.connection_id) {
    throw new ValidationError(
      `${row.key} has no project yet. Choose one in Platform › Environments, then look for its services`,
    );
  }
  const provider = (await registryOf(providers)).get(row.provider);
  if (!provider.adopt) {
    throw new ValidationError(`${provider.name} cannot adopt services that already run yet`);
  }
  const connection = toRecord(await requireConnection(sql, row.connection_id));
  const configured = connection.config['region'];
  return {
    environment: {
      id: row.id,
      key: row.key,
      name: row.name,
      class: row.class as EnvironmentClass,
      protected: row.protected,
      defaultRuntime: row.default_runtime,
    },
    connection,
    adopt: provider.adopt,
    place: {
      account: row.external_id,
      region: row.region ?? (typeof configured === 'string' ? configured : 'us-central1'),
      accountConfig: row.account_config ?? {},
    },
    accountId: row.account_id,
  };
}
