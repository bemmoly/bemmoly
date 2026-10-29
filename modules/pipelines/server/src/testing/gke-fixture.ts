import type { PipelinesHarness } from './harness.ts';
import type { ShippingFixture } from './shipping-fixture.ts';

/*
 * The shipping fixture's environments given a project each, so each can have a cluster and
 * secrets, and cart-api beside checkout-api in the same group, with its own releases.
 */

export interface GkeFixture {
  cart: string;
  cartRelease(version: string, config?: Record<string, unknown>): Promise<string>;
}

export async function seedGkeFixture(
  harness: PipelinesHarness,
  f: ShippingFixture,
): Promise<GkeFixture> {
  const { sql, users } = harness;
  const [connection] = await sql<{ id: string }[]>`select id from cloud_connections limit 1`;
  for (const [key, id] of Object.entries(f.environments)) {
    const [account] = await sql<{ id: string }[]>`
      insert into cloud_accounts (connection_id, external_id, name, purpose, status)
      values (${connection?.id ?? ''}, ${`acme-${key.toLowerCase()}`}, ${key}, 'workload', 'ready')
      returning id`;
    await sql`update pipeline_environments set cloud_account_id = ${account?.id ?? ''},
      region = 'us-central1' where id = ${id}`;
  }
  const [app] = await sql<{ id: string }[]>`
    insert into pipeline_applications
      (key, name, domain_id, group_id, owner_team_id, tier, runtime, health)
    select 'cart-api', 'cart-api', domain_id, group_id, owner_team_id, 1, 'container-service',
      'healthy'
    from pipeline_applications where id = ${f.app}
    returning id`;
  const cart = app?.id ?? '';
  return {
    cart,
    async cartRelease(version, config = {}) {
      const [row] = await sql<{ id: string }[]>`
        insert into pipeline_releases
          (application_id, version, commit_sha, resolved_config, test_summary, created_by)
        values (${cart}, ${version}, 'b2d8f41', ${JSON.stringify(config)}::jsonb,
          '{"total": 4, "passed": 4, "failed": 0, "skipped": 0}'::jsonb, ${users.member})
        returning id`;
      return row?.id ?? '';
    },
  };
}
