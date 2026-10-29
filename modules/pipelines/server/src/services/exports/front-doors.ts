import type { SqlClient } from '@bemmoly/core';
import type { StoredBackend } from '../../models/front-doors.ts';
import type { ExportFrontDoor } from '../providers/export-contract.ts';

/*
 * The front doors whose hosts live in one connection's projects, with each host's weights as
 * the cloud was last given them. A host that a move between runtimes or a canary is still
 * shifting is marked moving, so the export can say its weights are in flight.
 */

const OPEN_MOVES = ['planned', 'deploying', 'warming', 'shifting', 'holding', 'paused'];

interface Row {
  environment: string;
  region: string | null;
  domain: string | null;
  status: string;
  account: string;
  application: string;
  namespace: string;
  host: string;
  backends: StoredBackend[];
  moving: boolean;
}

export async function frontDoors(
  sql: SqlClient,
  connectionId: string,
  leftOut: string[],
): Promise<ExportFrontDoor[]> {
  const rows = await sql<Row[]>`
    select e.key as environment, e.region, d.domain, d.status, r.account,
      a.key as application, g.key as namespace, r.host, r.backends,
      (exists (select 1 from pipeline_runtime_moves m
        where m.application_id = r.application_id and m.environment_id = d.environment_id
          and m.state = any(${OPEN_MOVES}::text[]))
        or coalesce(c.state <> 'idle', false)) as moving
    from pipeline_front_doors d
    join pipeline_environments e on e.id = d.environment_id
    join pipeline_front_door_routes r on r.front_door_id = d.id
    join pipeline_applications a on a.id = r.application_id
    join pipeline_groups g on g.id = a.group_id
    join cloud_accounts ca on ca.external_id = r.account and ca.connection_id = ${connectionId}
    left join pipeline_current c
      on c.application_id = r.application_id and c.environment_id = d.environment_id
    where d.enabled and e.archived_at is null
    order by e.position, e.key, r.account, r.host`;
  const doors = new Map<string, ExportFrontDoor & { hosts: ExportFrontDoor['hosts'][number][] }>();
  const unready = new Set<string>();
  for (const row of rows) {
    if (row.status !== 'ready') {
      unready.add(`${row.environment} (${row.status})`);
      continue;
    }
    const key = `${row.environment}/${row.account}`;
    const door = doors.get(key) ?? {
      environment: row.environment,
      account: row.account,
      region: row.region,
      domain: row.domain,
      hosts: [],
    };
    door.hosts.push({
      application: row.application,
      namespace: row.namespace,
      host: row.host,
      backends: row.backends,
      moving: row.moving,
    });
    doors.set(key, door);
  }
  for (const environment of unready) {
    leftOut.push(`The front door in ${environment} is not ready, so it is left out.`);
  }
  return [...doors.values()];
}
