import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  createDatabase,
  createRequestAuthorization,
  loadModules,
  type RequestContext,
  type SqlClient,
} from '@bemmoly/core';
import pipelines from '../../module.ts';
import { createAccessEngine } from '../../server/src/services/access/engine.ts';
import { createDefaultProviders } from '../../server/src/services/providers/index.ts';
import { createProviderRegistry } from '../../server/src/services/providers/registry.ts';
import { createWebhookCaller } from '../../server/src/services/shipping/gates/index.ts';
import {
  createShippingAccess,
  createShippingService,
  type ShippingService,
} from '../../server/src/services/shipping/index.ts';

/*
 * The pieces of the local deploy demo: point the environments at this machine's Docker,
 * shorten the rollout timings for a laptop, make releases of one seeded application (one
 * good, one that fails its Prod canary), and drive the shipping engine. Everything goes
 * through the same services the server uses; only the timings are shortened.
 */

/** Tier 1: one approval from its team, a canary in Prod, no deploy window to wait for. */
export const DEMO_APP = 'pricing-svc';

const SETTINGS: ReadonlyArray<[string, number]> = [
  ['pipelines.rollout.holdMinutes', 1],
  ['pipelines.rollout.watchMinutes', 1],
  ['pipelines.rollout.sampleSeconds', 10],
];

export function dockerHost(given: string | undefined): string {
  if (given) return given;
  const found = [join(homedir(), '.colima/default/docker.sock'), '/var/run/docker.sock'].find(
    (path) => existsSync(path),
  );
  if (!found) throw new Error('No Docker socket found. Start Docker or Colima, or pass --docker.');
  return `unix://${found}`;
}

export function demoShipping(sql: SqlClient): {
  shipping: ShippingService;
  as(userId: string): RequestContext;
} {
  const modules = loadModules({ available: [pipelines], enabled: ['pipelines'] });
  const authz = createRequestAuthorization({ db: createDatabase(sql), modules });
  const settings = {
    get: async (key: string) => {
      const [row] = await sql<{ value: unknown }[]>`select value from settings where key = ${key}`;
      return row?.value;
    },
  };
  const shipping = createShippingService({
    sql,
    settings: settings as never,
    providers: createProviderRegistry(createDefaultProviders({ simulate: false })),
    access: createShippingAccess(createAccessEngine({ database: sql })),
    webhook: createWebhookCaller(async () => null),
    now: () => new Date(),
    wake: async () => undefined,
  });
  return { shipping, as: (userId) => ({ actor: { kind: 'user', id: userId }, authz }) };
}

export interface DemoPerson {
  id: string;
  name: string;
}

/** Two engineers of the team that owns the demo application: one writes, one approves. */
export async function demoPeople(
  sql: SqlClient,
): Promise<{ author: DemoPerson; approver: DemoPerson }> {
  const rows = await sql<DemoPerson[]>`
    select u.id, u.name from pipeline_applications a
    join team_members m on m.team_id = a.owner_team_id
    join users u on u.id = m.user_id join roles r on r.id = u.role_id
    where a.key = ${DEMO_APP} and r.key <> 'org_admin' and u.status = 'active'
    order by u.name limit 2`;
  const [author, approver] = rows;
  if (!author || !approver) {
    throw new Error(`${DEMO_APP} needs two people in its team; run the Pipelines demo seed first`);
  }
  return { author, approver };
}

/** Docker connection, environments on it, short timings, the admin in the owning team. */
export async function pointAtDocker(sql: SqlClient, docker: string): Promise<void> {
  // Twenty requests a second gives a 5% canary enough traffic to judge within its hold.
  const config = JSON.stringify({ dockerHost: docker, syntheticRps: 20 });
  await sql`
    insert into cloud_connections (provider, name, status, layout, config, principal, last_checked_at)
    values ('local', 'This machine', 'connected', 'per-environment', ${config}::jsonb,
      ${`docker at ${docker}`}, now())
    on conflict (lower(name)) do update
      set config = cloud_connections.config || excluded.config, status = 'connected'`;
  await sql`update pipeline_environments set provider = 'local' where archived_at is null`;
  // A laptop demo happens whenever its owner has time, so deploy windows are lifted and kept
  // aside; undo puts them back.
  await sql`
    update pipeline_environments
    set protection = (protection - 'window')
      || jsonb_build_object('windowBeforeDemo', protection -> 'window')
    where protection ? 'window' and protection ->> 'window' is not null`;
  // Bake times between Prod regions shrink to a minute; the originals wait in the
  // connection's config for undo, kept from the first setup if it runs twice.
  await sql`
    update cloud_connections set config = config || jsonb_build_object('bakeBeforeDemo',
      (select coalesce(jsonb_object_agg(id, bake_minutes), '{}'::jsonb)
       from pipeline_environment_path_steps where bake_minutes > 1))
    where provider = 'local' and lower(name) = 'this machine' and not config ? 'bakeBeforeDemo'`;
  await sql`update pipeline_environment_path_steps set bake_minutes = 1 where bake_minutes > 1`;
  for (const [key, value] of SETTINGS) {
    await sql`insert into settings (key, value) values (${key}, ${JSON.stringify(value)}::jsonb)
      on conflict (key) do update set value = excluded.value`;
  }
  // The admin approves in the demo, so they sit in the team that owns the application.
  await sql`
    insert into team_members (team_id, user_id)
    select a.owner_team_id, u.id from pipeline_applications a, users u
    join roles r on r.id = u.role_id
    where a.key = ${DEMO_APP} and a.owner_team_id is not null and r.key = 'org_admin'
    on conflict do nothing`;
}

export async function pointBack(sql: SqlClient): Promise<void> {
  await sql`update pipeline_environments set provider = 'gcp' where provider = 'local'`;
  await sql`
    update pipeline_environments
    set protection = (protection - 'windowBeforeDemo')
      || jsonb_build_object('window', protection -> 'windowBeforeDemo')
    where protection ? 'windowBeforeDemo'`;
  for (const [key] of SETTINGS) await sql`delete from settings where key = ${key}`;
  await sql`
    update pipeline_environment_path_steps s set bake_minutes = (saved.value)::int
    from cloud_connections c, jsonb_each_text(c.config -> 'bakeBeforeDemo') saved
    where c.provider = 'local' and lower(c.name) = 'this machine' and s.id = (saved.key)::uuid`;
  await sql`update cloud_connections set config = config - 'bakeBeforeDemo'
    where provider = 'local' and lower(name) = 'this machine'`;
}

/** The next two minor versions after the newest release of the demo application. */
export async function makeReleases(sql: SqlClient, author: string) {
  const rows = await sql<{ id: string; version: string }[]>`
    select r.id, r.version from pipeline_releases r join pipeline_applications a on a.id = r.application_id
    where a.key = ${DEMO_APP}`;
  const minor = Math.max(
    0,
    ...rows.map((row) => Number(/^v?\d+\.(\d+)/.exec(row.version)?.[1] ?? 0)),
  );
  const [app] = await sql<
    { id: string }[]
  >`select id from pipeline_applications where key = ${DEMO_APP}`;
  if (!app) throw new Error(`${DEMO_APP} is not in the catalog; run the Pipelines demo seed first`);
  const make = async (version: string, config: Record<string, unknown>, notes: string) => {
    const [row] = await sql<{ id: string }[]>`
      insert into pipeline_releases
        (application_id, version, commit_sha, resolved_config, test_summary, provenance, notes,
         created_by)
      values (${app.id}, ${version}, ${Math.random().toString(16).slice(2, 9)},
        ${JSON.stringify(config)}::jsonb,
        '{"total": 214, "passed": 214, "failed": 0, "skipped": 0}'::jsonb,
        '{"kind": "slsa", "verified": true, "builder": "demo", "verifiedAt": null, "scan": {"high": 0, "critical": 0}}'::jsonb,
        ${notes}, ${author})
      on conflict (application_id, version) do update set notes = excluded.notes
      returning id`;
    return { id: row?.id ?? '', version };
  };
  return {
    good: await make(`v1.${minor + 1}.0`, { LOG_LEVEL: 'info' }, 'Round prices once, at checkout'),
    bad: await make(
      `v1.${minor + 2}.0`,
      { LOG_LEVEL: 'debug', 'demo.errorRate@prod-asia-south1': 0.3 },
      'Cache price lists (fails a third of requests in Prod asia-south1)',
    ),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sweeps the engine until the promotion stops moving or waits for a person. */
export async function driveUntilSettled(
  sql: SqlClient,
  shipping: ShippingService,
  promotionId: string,
  log: (line: string) => void,
): Promise<string> {
  let last = '';
  for (;;) {
    await shipping.engine.sweep();
    const [row] = await sql<{ state: string; outcome_reason: string | null }[]>`
      select state, outcome_reason from pipeline_promotions where id = ${promotionId}`;
    const state = row?.state ?? 'missing';
    if (state !== last) log(`${state}${row?.outcome_reason ? `: ${row.outcome_reason}` : ''}`);
    last = state;
    if (!['requested', 'gating', 'scheduled', 'rolling_out'].includes(state)) return state;
    const [paused] = await sql<{ pause_reason: string | null }[]>`
      select pause_reason from pipeline_deployments
      where promotion_id = ${promotionId} and state = 'waiting' limit 1`;
    if (paused) {
      log(
        `paused: ${paused.pause_reason ?? 'waiting for a person'} (decide on the deployment page)`,
      );
      return 'paused';
    }
    await sleep(2000);
  }
}
