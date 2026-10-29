import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { DeployRuntime, EnvironmentClass, Provider } from '../../../../shared/common.ts';
import type { MoveState, MoveStep, RuntimeMove } from '../../../../shared/moves.ts';
import type { RuntimeMoveRow } from '../../models/front-doors.ts';
import type { ProviderRegistry } from '../providers/registry.ts';
import { urlOf } from '../front-doors/routing.ts';
import { iso, isoOrNull } from '../../utils/time.ts';
import { moveCost, sizeOf } from './prices.ts';

/*
 * A move as the plan screen reads it: the steps and where it is in them, the downtime, the
 * month's cost before and after, what is untested and what a person does by hand, all
 * before anything starts, and which of Start, Pause, Continue and Roll back apply now.
 */

export interface MoveRow extends RuntimeMoveRow {
  application_key: string;
  application_name: string;
  environment_key: string;
  environment_name: string;
  environment_class: string;
  provider: string;
  release_version: string | null;
  resolved_config: Record<string, unknown> | null;
  host: string | null;
  domain: string | null;
  address: string | null;
  door_problems: string[] | null;
}

export async function selectMoves(
  sql: SqlExecutor,
  where: { id?: string; application?: string; environment?: string },
): Promise<MoveRow[]> {
  return sql<MoveRow[]>`
    select m.*, a.key as application_key, a.name as application_name,
      e.key as environment_key, e.name as environment_name, e.class as environment_class,
      e.provider, r.version as release_version, r.resolved_config, fr.host, d.domain,
      d.addresses ->> fr.account as address, d.problems as door_problems
    from pipeline_runtime_moves m
    join pipeline_applications a on a.id = m.application_id
    join pipeline_environments e on e.id = m.environment_id
    left join pipeline_releases r on r.id = m.release_id
    left join pipeline_front_doors d on d.environment_id = m.environment_id
    left join pipeline_front_door_routes fr
      on fr.front_door_id = d.id and fr.application_id = m.application_id
    where (${where.id ?? null}::uuid is null or m.id = ${where.id ?? null}::uuid)
      and (${where.application ?? null}::text is null or a.key = ${where.application ?? null})
      and (${where.environment ?? null}::text is null or e.key = ${where.environment ?? null})
    order by m.id desc limit 50`;
}

export async function requireMove(sql: SqlExecutor, id: string): Promise<MoveRow> {
  const [row] = await selectMoves(sql, { id });
  if (!row) throw new NotFoundError('No runtime move has that id');
  return row;
}

const LIVE: readonly MoveState[] = ['deploying', 'warming', 'shifting', 'holding'];
const ENDED: readonly MoveState[] = ['succeeded', 'rolled_back', 'failed', 'cancelled'];

function stepsOf(row: MoveRow): MoveStep[] {
  const state = (
    row.state === 'paused' ? (row.paused_state ?? 'shifting') : row.state
  ) as MoveState;
  const last = row.steps.length - 1;
  return row.steps.map((percent, index): MoveStep => {
    const at = { percent, holdMinutes: row.hold_minutes };
    if (state === 'succeeded') return { ...at, state: 'done' };
    if (state === 'shifting' || state === 'holding') {
      const current = state === 'holding' ? last : row.step_index;
      if (index < current) return { ...at, state: 'done' };
      return { ...at, state: index === current ? 'current' : 'next' };
    }
    if (ENDED.includes(state) && index < row.step_index) return { ...at, state: 'done' };
    return { ...at, state: 'next' };
  });
}

export function presentMove(row: MoveRow, registry: ProviderRegistry): RuntimeMove {
  const state = row.state as MoveState;
  const provider = registry.list().find((entry) => entry.id === (row.provider as Provider));
  const from = row.from_runtime as DeployRuntime;
  const to = row.to_runtime as DeployRuntime;
  const certificateWaits = (row.door_problems ?? []).filter((problem) =>
    row.host ? problem.includes(row.host) : false,
  );
  return {
    id: row.id,
    application: { key: row.application_key, name: row.application_name },
    environment: {
      id: row.environment_id,
      key: row.environment_key,
      name: row.environment_name,
      class: row.environment_class as EnvironmentClass,
    },
    from,
    to,
    state,
    release:
      row.release_id && row.release_version
        ? { id: row.release_id, version: row.release_version }
        : null,
    steps: stepsOf(row),
    percent: row.traffic_percent,
    frontDoor: row.host ? { host: row.host, url: urlOf(row.host, row.domain, row.address) } : null,
    downtime: row.host ? 'none' : 'address-change',
    cost: moveCost(from, to, sizeOf(row.resolved_config ?? {})),
    untested: [...(provider?.frontDoor?.untested ?? [])],
    byHand: certificateWaits,
    message: row.message,
    can: {
      start: state === 'planned',
      pause: LIVE.includes(state),
      continue: state === 'paused',
      rollBack: state === 'planned' || state === 'paused' || LIVE.includes(state),
    },
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    finishedAt: isoOrNull(row.finished_at),
  };
}
