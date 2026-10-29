import type { SqlClient } from '@bemmoly/core';
import { createAccessEngine } from '../services/access/engine.ts';
import {
  createFakeProvider,
  createFakeWorld,
  type FakeWorld,
} from '../services/providers/fake/index.ts';
import { createProviderRegistry } from '../services/providers/registry.ts';
import {
  createShippingAccess,
  createShippingService,
  type ShippingService,
} from '../services/shipping/index.ts';
import { createWebhookCaller } from '../services/shipping/gates/index.ts';
import type { PipelinesHarness } from './harness.ts';

/*
 * One application on a four-environment path, deployed through the fake provider on a clock
 * the test moves: Dev, Staging, then Prod in asia (canary) and us (after a bake). Priya asks
 * for promotions; Ravi, also in Payments, approves them.
 */

export interface ShippingFixture {
  service: ShippingService;
  world: FakeWorld;
  clock: { now: Date; advance(ms: number): void };
  app: string;
  ravi: string;
  environments: Record<'dev' | 'staging' | 'prodAsia' | 'prodUs', string>;
  release(version: string, config?: Record<string, unknown>): Promise<string>;
  /** Moves the clock in steps and sweeps until `done` or the time runs out. */
  runUntil(done: () => Promise<boolean>, minutes: number, stepSeconds?: number): Promise<boolean>;
}

async function one(query: Promise<{ id: string }[]>): Promise<string> {
  const [row] = await query;
  if (!row) throw new Error('fixture insert returned nothing');
  return row.id;
}

/** `world` shares the simulated cloud with the harness's own services, for tests using both. */
export async function seedShippingFixture(
  harness: PipelinesHarness,
  options: { world?: FakeWorld } = {},
): Promise<ShippingFixture> {
  const { sql, users } = harness;
  const ravi = await one(sql`insert into users (email, name, role_id)
    select 'ravi@example.test', 'Ravi Kumar', id from roles where key = 'member' returning id`);
  await sql`insert into module_grants (module_id, subject_kind, subject_id) values ('pipelines', 'user', ${ravi})`;
  const team = await one(sql`insert into teams (name) values ('Payments') returning id`);
  await sql`insert into team_members (team_id, user_id) values (${team}, ${users.member}), (${team}, ${ravi})`;
  const domain = await one(sql`insert into pipeline_domains (key, name, color, position)
    values ('commerce', 'Commerce', 'epic-1', 1) returning id`);
  const group = await one(sql`insert into pipeline_groups (domain_id, key, name)
    values (${domain}, 'checkout', 'Checkout') returning id`);
  const app = await one(sql`insert into pipeline_applications
      (key, name, domain_id, group_id, owner_team_id, tier, runtime, health)
    values ('checkout-api', 'checkout-api', ${domain}, ${group}, ${team}, 1, 'container-service', 'healthy')
    returning id`);
  const env = (key: string, name: string, cls: string, position: number, protection = '{}') =>
    one(sql`insert into pipeline_environments (key, name, class, position, protection)
      values (${key}, ${name}, ${cls}, ${position}, ${protection}::jsonb) returning id`);
  const environments = {
    dev: await env('dev', 'Dev', 'dev', 1),
    staging: await env('staging', 'Staging', 'staging', 2),
    prodAsia: await env(
      'prod-asia-south1',
      'Prod · asia-south1',
      'prod',
      3,
      '{"protected": true, "requiresApproval": true}',
    ),
    prodUs: await env(
      'prod-us-east1',
      'Prod · us-east1',
      'prod',
      4,
      '{"protected": true, "requiresApproval": true}',
    ),
  };
  const path = await one(
    sql`insert into pipeline_environment_paths (tier, name) values (1, 'Tier 1') returning id`,
  );
  await sql`insert into pipeline_environment_path_steps (path_id, environment_id, stage, bake_minutes)
    values (${path}, ${environments.dev}, 0, 0), (${path}, ${environments.staging}, 1, 0),
      (${path}, ${environments.prodAsia}, 2, 0), (${path}, ${environments.prodUs}, 3, 30)`;
  await sql`insert into cloud_connections (provider, name, status) values ('gcp', 'Simulated', 'connected')`;

  const world = options.world ?? createFakeWorld();
  const clock = {
    now: new Date('2026-10-13T06:00:00Z'),
    advance(ms: number) {
      clock.now = new Date(clock.now.getTime() + ms);
    },
  };
  const access = createShippingAccess(createAccessEngine({ database: sql }));
  const service = createShippingService({
    sql: sql as SqlClient,
    providers: createProviderRegistry([createFakeProvider(world, 'gcp')]),
    access,
    webhook: createWebhookCaller(async () => null),
    now: () => clock.now,
    wake: async () => undefined,
  });
  return {
    service,
    world,
    clock,
    app,
    ravi,
    environments,
    release: (version, config = {}) =>
      one(sql`insert into pipeline_releases
          (application_id, version, commit_sha, resolved_config, test_summary, created_by)
        values (${app}, ${version}, 'a1c9e3f', ${JSON.stringify(config)}::jsonb,
          '{"total": 12, "passed": 12, "failed": 0, "skipped": 0}'::jsonb, ${users.member})
        returning id`),
    async runUntil(done, minutes, stepSeconds = 60) {
      for (let elapsed = 0; elapsed <= minutes * 60; elapsed += stepSeconds) {
        await service.engine.sweep();
        if (await done()) return true;
        clock.advance(stepSeconds * 1000);
      }
      return done();
    },
  };
}
