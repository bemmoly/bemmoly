import type { SqlClient } from '@bemmoly/core';
import type { DeployRuntime } from '../../../../shared/common.ts';
import type { FrontDoorRouteRow, FrontDoorRow, StoredBackend } from '../../models/front-doors.ts';
import type { FrontDoorBackend } from '../providers/front-door-contract.ts';
import type { ProviderSourceOrRegistry } from '../shipping/engine-deps.ts';
import { resolveTarget, type ResolvedTarget } from '../shipping/targets.ts';
import {
  FRONT_DOOR_COLUMNS,
  hostOf,
  ROUTE_COLUMNS,
  routeOf,
  specOf,
  writeRoute,
} from './routing.ts';

/*
 * Making a front door match its row. Turned on, it reserves an address in each project the
 * environment's applications run in, and gives every application released there a host at
 * the runtime it runs on now: Cloud Run's service, or GKE's revisions at their weights. An
 * application with a host already keeps its weights, which only deploys and moves change.
 * Turned off, it takes every part down. Problems are kept as sentences for the screen.
 */

interface Placed {
  application: { id: string; key: string };
  resolved: ResolvedTarget;
}

const runtimeOf = (resolved: ResolvedTarget): DeployRuntime =>
  resolved.target.placement?.runtime ?? 'cloud-run';

/** Where an application's traffic goes now, as front door backends; null when nowhere. */
async function currentBackends(resolved: ResolvedTarget): Promise<FrontDoorBackend[] | null> {
  const { provider, target } = resolved;
  if (!provider.frontDoor?.routesRevisions.includes(runtimeOf(resolved))) {
    return [{ target, revision: null, percent: 100 }];
  }
  const live = await provider.targets?.describe(target);
  const traffic = live?.traffic.filter((weight) => weight.percent > 0) ?? [];
  if (traffic.length === 0) return null;
  const total = traffic.reduce((sum, weight) => sum + weight.percent, 0);
  let left = 100;
  return traffic.map((weight, index) => {
    const percent =
      index === traffic.length - 1 ? left : Math.round((weight.percent * 100) / total);
    left -= percent;
    return { target, revision: weight.revision, percent };
  });
}

export async function applyFrontDoor(
  sql: SqlClient,
  providers: ProviderSourceOrRegistry,
  id: string,
): Promise<void> {
  const [claimed] = await sql<{ id: string }[]>`
    update pipeline_front_doors set status = 'applying', updated_at = now()
    where id = ${id} and (status <> 'applying' or updated_at < now() - interval '5 minutes')
    returning id`;
  if (!claimed) return;
  const [door] = await sql<FrontDoorRow[]>`
    select ${sql.unsafe(FRONT_DOOR_COLUMNS)} from pipeline_front_doors d
    join pipeline_environments e on e.id = d.environment_id where d.id = ${id}`;
  if (!door) return;
  const resolve = (applicationId: string, runtime?: DeployRuntime) =>
    resolveTarget(sql, providers, applicationId, door.environment_id, {
      frontDoor: false,
      ...(runtime ? { runtime } : {}),
    });
  try {
    if (!door.enabled) {
      await takeDown(sql, door, resolve);
      await sql`update pipeline_front_doors set status = 'off', addresses = '{}'::jsonb,
        problems = '[]'::jsonb, applied_at = now(), updated_at = now() where id = ${id}`;
      return;
    }
    const problems: string[] = [];
    const addresses: Record<string, string> = { ...door.addresses };
    const released = await sql<{ id: string; key: string }[]>`
      select a.id, a.key from pipeline_current c
      join pipeline_applications a on a.id = c.application_id
      where c.environment_id = ${door.environment_id} and c.release_id is not null
        and a.archived_at is null
      order by a.key`;
    const placed: Placed[] = [];
    for (const application of released) {
      try {
        placed.push({ application, resolved: await resolve(application.id) });
      } catch (error) {
        problems.push(`${application.key}: ${(error as Error).message}`);
      }
    }
    const byAccount = new Map<string, Placed[]>();
    for (const item of placed) {
      const account = item.resolved.target.account?.externalId ?? '';
      byAccount.set(account, [...(byAccount.get(account) ?? []), item]);
    }
    for (const [account, items] of byAccount) {
      const first = items[0];
      const part = first?.resolved.provider.frontDoor;
      if (!first || !part) {
        problems.push(`${first?.resolved.provider.name ?? 'This cloud'} has no front door yet`);
        continue;
      }
      const hosts = items.map((item) => hostOf(item.application.key, door.domain));
      const state = await part.ensure(
        first.resolved.target.connection,
        specOf(door, first.resolved.target),
        hosts,
      );
      if (state.address) addresses[account] = state.address;
      problems.push(...state.problems);
    }
    for (const { application, resolved } of placed) {
      if (!resolved.provider.frontDoor) continue;
      const route = await routeOf(sql, door.id, application.id);
      if (route?.host === hostOf(application.key, door.domain)) continue;
      try {
        const backends = route
          ? await rebuild(route.backends, (runtime) => resolve(application.id, runtime))
          : await currentBackends(resolved);
        if (backends) await writeRoute(sql, resolved.provider, door, backends);
      } catch (error) {
        problems.push(`${application.key}: ${(error as Error).message}`);
      }
    }
    await sql`update pipeline_front_doors set status = 'ready',
      addresses = ${JSON.stringify(addresses)}::jsonb, problems = ${JSON.stringify(problems)}::jsonb,
      applied_at = now(), updated_at = now() where id = ${id}`;
  } catch (error) {
    await sql`update pipeline_front_doors set status = 'failed',
      problems = ${JSON.stringify([(error as Error).message])}::jsonb, updated_at = now()
      where id = ${id}`;
  }
}

/** A host's stored weights as backends again, each runtime's target resolved anew. */
async function rebuild(
  stored: readonly StoredBackend[],
  resolve: (runtime: DeployRuntime) => Promise<ResolvedTarget>,
): Promise<FrontDoorBackend[]> {
  const backends: FrontDoorBackend[] = [];
  for (const backend of stored) {
    const { target } = await resolve(backend.runtime as DeployRuntime);
    backends.push({ target, revision: backend.revision, percent: backend.percent });
  }
  return backends;
}

async function takeDown(
  sql: SqlClient,
  door: FrontDoorRow,
  resolve: (applicationId: string) => Promise<ResolvedTarget>,
) {
  const routes = await sql<FrontDoorRouteRow[]>`
    select ${sql.unsafe(ROUTE_COLUMNS)} from pipeline_front_door_routes r
    join pipeline_applications a on a.id = r.application_id
    where r.front_door_id = ${door.id}`;
  const accounts = new Map<string, FrontDoorRouteRow[]>();
  for (const route of routes)
    accounts.set(route.account, [...(accounts.get(route.account) ?? []), route]);
  for (const items of accounts.values()) {
    const first = items[0];
    if (!first) continue;
    const { provider, target } = await resolve(first.application_id);
    await provider.frontDoor?.remove(
      target.connection,
      specOf(door, target),
      items.map((item) => item.host),
    );
  }
  await sql`delete from pipeline_front_door_routes where front_door_id = ${door.id}`;
}
