import type { SqlExecutor } from '@bemmoly/core';
import type { DeployRuntime } from '../../../../shared/common.ts';
import { appReferencesOf } from '../../../../shared/app-references.ts';
import type { ServiceAddress } from '../providers/deploy-settings-contract.ts';
import { urlOf } from '../front-doors/routing.ts';

/*
 * Where each application answers in each environment, recorded after every deploy, and the
 * `${{ apps.<key>.url }}` references filled in from it. A front door's host wins for
 * `publicUrl`, since that is the address the internet keeps through a runtime move.
 */

export async function recordAddress(
  sql: SqlExecutor,
  input: {
    applicationId: string;
    environmentId: string;
    runtime: DeployRuntime;
    address: ServiceAddress;
  },
): Promise<void> {
  await sql`
    insert into pipeline_service_addresses (application_id, environment_id, runtime, url, public_url)
    values (${input.applicationId}, ${input.environmentId}, ${input.runtime},
      ${input.address.url}, ${input.address.publicUrl})
    on conflict (application_id, environment_id) do update set
      runtime = excluded.runtime, url = excluded.url, public_url = excluded.public_url,
      deployed_at = now()`;
}

export interface KnownAddress {
  url: string | null;
  publicUrl: string | null;
}

/** "cart-api@prod" → its addresses, for the applications and environments asked about. */
export async function addressesFor(
  sql: SqlExecutor,
  applications: readonly string[],
  environmentIds: readonly string[],
): Promise<Map<string, KnownAddress>> {
  if (applications.length === 0 || environmentIds.length === 0) return new Map();
  const rows = await sql<
    {
      application_key: string;
      environment_key: string;
      url: string | null;
      public_url: string | null;
      route_host: string | null;
      route_domain: string | null;
      route_address: string | null;
    }[]
  >`
    select a.key as application_key, e.key as environment_key, s.url, s.public_url,
      fr.host as route_host, d.domain as route_domain, d.addresses ->> fr.account as route_address
    from pipeline_service_addresses s
    join pipeline_applications a on a.id = s.application_id
    join pipeline_environments e on e.id = s.environment_id
    left join pipeline_front_doors d on d.environment_id = e.id and d.enabled
    left join pipeline_front_door_routes fr
      on fr.front_door_id = d.id and fr.application_id = a.id
    where a.key = any(${[...applications]}::text[])
      and e.id = any(${[...environmentIds]}::uuid[])`;
  return new Map(
    rows.map((row) => [
      `${row.application_key}@${row.environment_key}`,
      {
        url: row.url,
        publicUrl:
          (row.route_host ? urlOf(row.route_host, row.route_domain, row.route_address) : null) ??
          row.public_url,
      },
    ]),
  );
}

/** Every application a value names. */
export const referencedApplications = (values: readonly string[]) => [
  ...new Set(values.flatMap((value) => appReferencesOf(value).map((ref) => ref.application))),
];

/**
 * The value with each reference filled in for one environment, or the sentence saying which
 * application is not there yet. Callees deploy before their callers.
 */
export function fillReferences(
  value: string,
  environment: string,
  addresses: ReadonlyMap<string, KnownAddress>,
): { value: string | null; problem: string | null } {
  let filled = value;
  for (const ref of appReferencesOf(value)) {
    const known = addresses.get(`${ref.application}@${environment}`);
    if (!known) {
      return {
        value: null,
        problem: `${ref.application} is not deployed to ${environment} yet. Deploy ${ref.application} there first`,
      };
    }
    const address = ref.field === 'url' ? known.url : known.publicUrl;
    if (!address) {
      return {
        value: null,
        problem:
          ref.field === 'url'
            ? `${ref.application} has no address in ${environment} yet. Deploy it there again`
            : `${ref.application} has no public address in ${environment} yet. Turn on the front door there, or wait for its Gateway`,
      };
    }
    filled = filled.replace(ref.text, address);
  }
  return { value: filled, problem: null };
}
