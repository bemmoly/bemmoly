import type { SqlClient } from '@bemmoly/core';
import { cloudResourceKindSchema } from '../../../../shared/clouds.ts';
import type { ConnectionRow } from '../../models/clouds.ts';
import { listAccountRows, listResourceRows } from '../clouds/records.ts';
import { toRecord } from '../clouds/store.ts';
import { poolConfigOf } from '../machines/store.ts';
import type {
  ExportCluster,
  ExportRecords,
  ExportResource,
  ExportService,
} from '../providers/export-contract.ts';
import { SPEC_SCHEMAS } from '../providers/specs.ts';

/*
 * What Pipelines recorded about one connection, gathered for its export: the accounts, the
 * landing zone resources that were applied, the clusters it made or attached, the secrets it
 * wrote and the Cloud Build pools that start builds there. One application's export keeps only
 * that application's services and secrets.
 */

interface ClusterRow {
  id: string;
  origin: string;
  mode: string;
  project_id: string;
  location: string;
  name: string;
  status: string;
  gateway: ExportCluster['gateway'];
  environment: string;
}

async function landingZone(sql: SqlClient, connectionId: string, leftOut: string[]) {
  const resources: ExportResource[] = [];
  let unapplied = 0;
  for (const row of await listResourceRows(sql, connectionId)) {
    if (!row.last_reconciled_at) {
      unapplied += 1;
      continue;
    }
    const kind = cloudResourceKindSchema.safeParse(row.kind);
    const spec = kind.success ? SPEC_SCHEMAS[kind.data].safeParse(row.desired) : null;
    if (!kind.success || !spec?.success) {
      leftOut.push(
        `${row.kind} ${row.name} in ${row.account_external_id}: its recorded settings are incomplete.`,
      );
      continue;
    }
    resources.push({
      kind: kind.data,
      name: row.name,
      account: row.account_external_id,
      spec: row.desired,
    });
  }
  if (unapplied > 0) {
    leftOut.push(
      `${unapplied} landing zone resources were never applied, so nothing exists to adopt.`,
    );
  }
  return resources;
}

async function clusters(sql: SqlClient, connectionId: string, leftOut: string[]) {
  const rows = await sql<ClusterRow[]>`
    select k.id, k.origin, k.mode, k.project_id, k.location, k.name, k.status, k.gateway,
      e.key as environment
    from cloud_clusters k join pipeline_environments e on e.id = k.environment_id
    where k.connection_id = ${connectionId}
    order by e.position, e.key`;
  return rows.flatMap((row): ExportCluster[] => {
    if (row.origin === 'created' && row.status !== 'ready') {
      leftOut.push(`Cluster ${row.name} is ${row.status}, not running, so it is left out.`);
      return [];
    }
    return [
      {
        id: row.id,
        origin: row.origin === 'attached' ? 'attached' : 'created',
        mode: row.mode === 'standard' ? 'standard' : 'autopilot',
        projectId: row.project_id,
        location: row.location,
        name: row.name,
        gateway: row.gateway,
        environment: row.environment,
      },
    ];
  });
}

async function secrets(sql: SqlClient, connectionId: string, application: string | undefined) {
  return sql<Array<{ account: string; name: string }>>`
    select distinct a.external_id as account, v.secret_ref as name
    from pipeline_variables v
    join cloud_accounts a on a.id = v.secret_account_id
    join pipeline_applications app on app.id = v.application_id
    where v.kind = 'secret' and v.secret_ref is not null and a.connection_id = ${connectionId}
      and (${application ?? null}::text is null or app.key = ${application ?? null})
    order by 1, 2`;
}

async function pools(sql: SqlClient, connectionId: string) {
  const rows = await sql<Array<{ key: string; config: unknown; account: string }>>`
    select p.key, p.config, a.external_id as account
    from pipeline_runner_pools p join cloud_accounts a on a.id = p.cloud_account_id
    where p.hosting = 'cloud-build' and a.connection_id = ${connectionId}
    order by p.key`;
  return rows.flatMap((row) => {
    const build = poolConfigOf(row.config).cloudBuild;
    return build
      ? [
          {
            key: row.key,
            account: row.account,
            region: build.region,
            image: build.image,
            machine: build.machine,
            serviceAccount: build.serviceAccount,
          },
        ]
      : [];
  });
}

export async function connectionRecords(
  sql: SqlClient,
  row: ConnectionRow,
  services: readonly ExportService[],
  application: string | undefined,
): Promise<ExportRecords> {
  const leftOut: string[] = [];
  const accounts = (await listAccountRows(sql, row.id)).map((account) => ({
    externalId: account.external_id,
    name: account.name,
    origin: account.origin === 'attached' ? ('attached' as const) : ('created' as const),
    purpose: account.purpose as ExportRecords['accounts'][number]['purpose'],
    config: account.config,
  }));
  const whole = application === undefined;
  return {
    connection: { ...toRecord(row), principal: row.principal },
    accounts,
    resources: whole ? await landingZone(sql, row.id, leftOut) : [],
    services,
    clusters: whole ? await clusters(sql, row.id, leftOut) : [],
    secrets: await secrets(sql, row.id, application),
    pools: whole ? await pools(sql, row.id) : [],
    leftOut,
  };
}
