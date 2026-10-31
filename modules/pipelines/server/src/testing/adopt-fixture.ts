import { handDeploy, handDeployedUrl, handWriteSecret } from '../services/providers/fake/adopt.ts';
import type { GkeFixture } from './gke-fixture.ts';
import type { PipelinesHarness } from './harness.ts';
import type { ShippingFixture } from './shipping-fixture.ts';

/*
 * Staging as someone ran it before Pipelines: three Cloud Run services deployed by hand in
 * its project, with plain variables, a secret each, settings as the console left them, and
 * checkout-api reading cart-api's run.app address. search-api joins the catalog beside them.
 */

export const STAGE_PROJECT = 'acme-staging';

export interface AdoptFixture {
  search: string;
  searchRelease(version: string, config?: Record<string, unknown>): Promise<string>;
  /** Each service's secret value, to search the database for. */
  sentinels: { cart: string; checkout: string; search: string };
}

export async function seedAdoptFixture(
  harness: PipelinesHarness,
  gke: GkeFixture,
): Promise<AdoptFixture> {
  const { sql, users, world } = harness;
  const [app] = await sql<{ id: string }[]>`
    insert into pipeline_applications
      (key, name, domain_id, group_id, owner_team_id, tier, runtime, health)
    select 'search-api', 'search-api', domain_id, group_id, owner_team_id, 1, 'container-service',
      'healthy'
    from pipeline_applications where id = ${gke.cart}
    returning id`;
  const search = app?.id ?? '';
  const sentinels = {
    cart: 'sentinel-3f9a1c-cart-db-value',
    checkout: 'sentinel-8b2e47-checkout-key-value',
    search: 'sentinel-d06c55-search-token-value',
  };
  const secret = (name: string, value: string) => ({
    secret: name,
    version: handWriteSecret(world, STAGE_PROJECT, name, value),
  });
  handDeploy(world, STAGE_PROJECT, {
    name: 'cart-api',
    variables: [
      { name: 'LOG_LEVEL', kind: 'plain', value: 'info' },
      {
        name: 'DB_PASSWORD',
        kind: 'secret',
        account: STAGE_PROJECT,
        ...secret('cart-db-password', sentinels.cart),
      },
    ],
    settings: {
      'scaling.min': 0,
      'scaling.max': 5,
      'scaling.concurrency': 80,
      port: 8080,
      'healthcheck.path': '/healthz',
    },
  });
  handDeploy(world, STAGE_PROJECT, {
    name: 'checkout-api',
    variables: [
      {
        name: 'CART_URL',
        kind: 'plain',
        value: `${handDeployedUrl(STAGE_PROJECT, 'cart-api')}/v2`,
      },
      {
        name: 'API_KEY',
        kind: 'secret',
        account: STAGE_PROJECT,
        ...secret('checkout-api-key', sentinels.checkout),
      },
    ],
    settings: { 'scaling.min': 0, port: 8080 },
  });
  handDeploy(world, STAGE_PROJECT, {
    name: 'search-api',
    variables: [
      { name: 'INDEX', kind: 'plain', value: 'products' },
      {
        name: 'SEARCH_TOKEN',
        kind: 'secret',
        account: STAGE_PROJECT,
        ...secret('search-token', sentinels.search),
      },
    ],
    settings: { 'scaling.min': 1, 'resources.memory': '512Mi' },
  });
  return {
    search,
    sentinels,
    async searchRelease(version, config = {}) {
      const [row] = await sql<{ id: string }[]>`
        insert into pipeline_releases
          (application_id, version, commit_sha, resolved_config, test_summary, created_by)
        values (${search}, ${version}, 'c3e9a52', ${JSON.stringify(config)}::jsonb,
          '{"total": 3, "passed": 3, "failed": 0, "skipped": 0}'::jsonb, ${users.member})
        returning id`;
      return row?.id ?? '';
    },
  };
}

/** One release to one environment, approved by Ravi where it needs it; answers how it ended. */
export async function shipTo(h: PipelinesHarness, f: ShippingFixture, release: string, to: string) {
  const { promotion } = await f.service.requestPromotion(h.as(h.users.member), {
    release,
    to,
    mode: 'approval',
  });
  if (to.startsWith('prod')) {
    await f.service.decide(h.as(f.ravi), promotion.id, {
      decision: 'approved',
      releaseDigest: promotion.release.digest,
    });
  }
  const state = async () => {
    const [row] = await h.sql<{ state: string; outcome_reason: string | null }[]>`
      select state, outcome_reason from pipeline_promotions where id = ${promotion.id}`;
    return row;
  };
  await f.runUntil(
    async () => ['succeeded', 'rolled_back', 'failed'].includes((await state())?.state ?? ''),
    120,
  );
  return state();
}
