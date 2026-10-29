import type { SqlExecutor } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import type { DeployRuntime } from '../../../../shared/common.ts';
import type { FrontDoorRouteRow, FrontDoorRow, StoredBackend } from '../../models/front-doors.ts';
import type { CloudProvider, DeployTarget } from '../providers/contract.ts';
import type { FrontDoorBackend, FrontDoorSpec } from '../providers/front-door-contract.ts';

/*
 * What every part of Pipelines that moves a front door's weights shares: the host an
 * application answers on, the spec the provider is handed, and one write that sends a
 * host's weights to the cloud and then records them, so the stored weights never claim
 * more than the cloud was told.
 */

/** "checkout-api.prod.example.com" with a domain; the application's key as the Host without. */
export const hostOf = (application: string, domain: string | null) =>
  domain ? `${application}.${domain}` : application;

export function urlOf(host: string, domain: string | null, address: string | null) {
  if (domain) return `https://${host}`;
  return address ? `http://${address}` : null;
}

export const FRONT_DOOR_COLUMNS = `d.id, d.environment_id, e.key as environment_key,
  e.name as environment_name, e.class as environment_class, d.enabled, d.domain, d.status,
  d.addresses, d.problems, d.applied_at`;

export const ROUTE_COLUMNS = `r.id, r.front_door_id, r.application_id, a.key as application_key,
  a.name as application_name, r.account, r.host, r.backends`;

/** The environment's front door, when it is turned on. */
export async function enabledDoor(
  sql: SqlExecutor,
  environmentId: string,
): Promise<FrontDoorRow | null> {
  const [row] = await sql<FrontDoorRow[]>`
    select ${sql.unsafe(FRONT_DOOR_COLUMNS)} from pipeline_front_doors d
    join pipeline_environments e on e.id = d.environment_id
    where d.environment_id = ${environmentId} and d.enabled`;
  return row ?? null;
}

export async function routeOf(
  sql: SqlExecutor,
  doorId: string,
  applicationId: string,
): Promise<FrontDoorRouteRow | null> {
  const [row] = await sql<FrontDoorRouteRow[]>`
    select ${sql.unsafe(ROUTE_COLUMNS)} from pipeline_front_door_routes r
    join pipeline_applications a on a.id = r.application_id
    where r.front_door_id = ${doorId} and r.application_id = ${applicationId}`;
  return row ?? null;
}

/** The runtime that takes most of a host's traffic. */
export function servingRuntime(
  backends: ReadonlyArray<Pick<StoredBackend, 'runtime' | 'percent'>>,
): DeployRuntime | null {
  const heaviest = [...backends].sort((a, b) => b.percent - a.percent)[0];
  return (heaviest?.runtime as DeployRuntime | undefined) ?? null;
}

export function specOf(door: FrontDoorRow, target: DeployTarget): FrontDoorSpec {
  if (!target.account) {
    throw new ProviderError(
      `${door.environment_key} has no project for ${target.application.key} yet. Choose one in Platform › Environments`,
    );
  }
  return {
    environment: door.environment_key,
    account: {
      externalId: target.account.externalId,
      ...(target.account.config ? { config: target.account.config } : {}),
    },
    region: target.environment.region,
    domain: door.domain,
  };
}

/** Sends one application's weights to the cloud, then records them. */
export async function writeRoute(
  sql: SqlExecutor,
  provider: CloudProvider,
  door: FrontDoorRow,
  backends: readonly FrontDoorBackend[],
): Promise<void> {
  const first = backends[0];
  if (!first || !provider.frontDoor) {
    throw new ProviderError(`${provider.name} has no front door yet`);
  }
  const { target } = first;
  const spec = specOf(door, target);
  const host = hostOf(target.application.key, door.domain);
  await provider.frontDoor.route(target.connection, spec, {
    application: target.application.key,
    host,
    backends,
  });
  const stored: StoredBackend[] = backends.map((backend) => ({
    runtime: backend.target.placement?.runtime ?? 'cloud-run',
    revision: backend.revision,
    percent: backend.percent,
  }));
  await sql`
    insert into pipeline_front_door_routes (front_door_id, application_id, account, host, backends)
    values (${door.id}, ${target.application.id}, ${spec.account.externalId}, ${host},
      ${JSON.stringify(stored)}::jsonb)
    on conflict (front_door_id, application_id) do update set
      account = excluded.account, host = excluded.host, backends = excluded.backends,
      updated_at = now()`;
}
