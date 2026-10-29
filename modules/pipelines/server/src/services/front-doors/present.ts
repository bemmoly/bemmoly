import type { SqlExecutor } from '@bemmoly/core';
import type { DeployRuntime, EnvironmentClass } from '../../../../shared/common.ts';
import type { FrontDoor, FrontDoorStatus } from '../../../../shared/front-doors.ts';
import type { FrontDoorRouteRow, FrontDoorRow } from '../../models/front-doors.ts';
import { isoOrNull } from '../../utils/time.ts';
import { FRONT_DOOR_COLUMNS, ROUTE_COLUMNS, urlOf } from './routing.ts';

/* Front doors as GET /front-doors shows them, each with its routes. */

export async function selectFrontDoors(
  sql: SqlExecutor,
  where: { environment?: string; application?: string } = {},
): Promise<FrontDoor[]> {
  const doors = await sql<FrontDoorRow[]>`
    select ${sql.unsafe(FRONT_DOOR_COLUMNS)} from pipeline_front_doors d
    join pipeline_environments e on e.id = d.environment_id
    where e.archived_at is null
      and (${where.environment ?? null}::text is null or e.key = ${where.environment ?? null})
    order by e.position, e.id`;
  if (doors.length === 0) return [];
  const routes = await sql<FrontDoorRouteRow[]>`
    select ${sql.unsafe(ROUTE_COLUMNS)} from pipeline_front_door_routes r
    join pipeline_applications a on a.id = r.application_id
    where r.front_door_id = any(${doors.map((door) => door.id)}::uuid[])
      and (${where.application ?? null}::text is null or a.key = ${where.application ?? null})
    order by a.key`;
  return doors.map((door) => ({
    id: door.id,
    environment: {
      id: door.environment_id,
      key: door.environment_key,
      name: door.environment_name,
      class: door.environment_class as EnvironmentClass,
    },
    enabled: door.enabled,
    domain: door.domain,
    status: door.status as FrontDoorStatus,
    addresses: Object.entries(door.addresses).map(([account, address]) => ({ account, address })),
    problems: door.problems,
    routes: routes
      .filter((route) => route.front_door_id === door.id)
      .map((route) => ({
        application: { key: route.application_key, name: route.application_name },
        account: route.account,
        host: route.host,
        url: urlOf(route.host, door.domain, door.addresses[route.account] ?? null),
        backends: route.backends.map((backend) => ({
          runtime: backend.runtime as DeployRuntime,
          revision: backend.revision,
          percent: backend.percent,
        })),
      })),
    appliedAt: isoOrNull(door.applied_at),
  }));
}
