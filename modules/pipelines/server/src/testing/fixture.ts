import type { SqlClient } from '@bemmoly/core';

/*
 * A small catalog the endpoint tests read: two domains, three groups, two teams (the member
 * is in Payments), five applications across tiers and runtimes, three environments with one
 * deployment moving, a week of rollups and live jobs.
 */

export interface CatalogFixture {
  teams: { payments: string; search: string };
  applications: Record<string, string>;
}

async function one(query: Promise<{ id: string }[]>): Promise<string> {
  const [row] = await query;
  if (!row) throw new Error('fixture insert returned nothing');
  return row.id;
}

export async function seedCatalogFixture(sql: SqlClient, member: string): Promise<CatalogFixture> {
  await sql`insert into settings (key, value) values ('workspace.name', '"Acme"'::jsonb)`;
  const payments = await one(sql`insert into teams (name) values ('Payments') returning id`);
  const search = await one(sql`insert into teams (name) values ('Search') returning id`);
  await sql`insert into team_members (team_id, user_id) values (${payments}, ${member})`;
  const commerce = await one(sql`insert into pipeline_domains (key, name, color, position)
      values ('commerce', 'Commerce', 'epic-1', 1) returning id`);
  const data = await one(sql`insert into pipeline_domains (key, name, color, position)
      values ('data', 'Data', 'epic-3', 2) returning id`);
  const checkout = await one(sql`insert into pipeline_groups (domain_id, key, name)
      values (${commerce}, 'checkout', 'Checkout') returning id`);
  const pricing = await one(sql`insert into pipeline_groups (domain_id, key, name)
      values (${commerce}, 'pricing', 'Pricing') returning id`);
  const lake = await one(sql`insert into pipeline_groups (domain_id, key, name)
      values (${data}, 'lake', 'Lake') returning id`);
  const repo = await one(sql`insert into pipeline_repositories (full_name, url)
      values ('acme/checkout', 'https://github.com/acme/checkout') returning id`);
  const rows: Array<[string, string, string, string, string | null, number, string, string[]]> = [
    [
      'checkout-api',
      'checkout-api',
      commerce,
      checkout,
      payments,
      0,
      'container-service',
      ['node', 'pci'],
    ],
    ['payments-worker', 'payments-worker', commerce, checkout, payments, 0, 'kubernetes', ['node']],
    ['gift-cards', 'gift-cards', commerce, checkout, null, 2, 'container-service', ['node']],
    ['pricing-svc', 'pricing-svc', commerce, pricing, search, 1, 'function', ['go']],
    ['lake-ingest', 'lake-ingest', data, lake, search, 2, 'kubernetes', ['python']],
  ];
  const applications: Record<string, string> = {};
  for (const [key, name, domain, group, team, tier, runtime, labels] of rows) {
    applications[key] = await one(sql`insert into pipeline_applications
          (key, name, domain_id, group_id, owner_team_id, tier, runtime, labels, repository_id,
           health, last_deployed_at)
        values (${key}, ${name}, ${domain}, ${group}, ${team}, ${tier}, ${runtime},
          ${labels}::text[], ${repo}, ${key === 'pricing-svc' ? 'failing' : 'healthy'},
          ${key === 'gift-cards' ? null : new Date().toISOString()}::timestamptz)
        returning id`);
  }
  const dev = await one(sql`insert into pipeline_environments (key, name, class, position)
      values ('dev', 'Dev', 'dev', 1) returning id`);
  const prod =
    await one(sql`insert into pipeline_environments (key, name, class, region, position, protection)
      values ('prod-asia-south1', 'Prod · asia-south1', 'prod', 'asia-south1', 3,
        '{"protected": true, "requiresApproval": true}'::jsonb) returning id`);
  await sql`
    insert into pipeline_environments (key, name, class, position)
    values ('staging', 'Staging', 'staging', 2)`;
  const path = await one(
    sql`insert into pipeline_environment_paths (tier, name) values (0, 'Tier 0') returning id`,
  );
  await sql`
    insert into pipeline_environment_path_steps (path_id, environment_id, stage, auto_promote)
    values (${path}, ${dev}, 0, true), (${path}, ${prod}, 2, false)`;
  const checkoutApi = applications['checkout-api'] ?? '';
  const release = await one(sql`insert into pipeline_releases (application_id, version, commit_sha)
      values (${checkoutApi}, 'v1.43.0', 'a1c9e3f') returning id`);
  await sql`
    insert into pipeline_current
      (application_id, environment_id, domain_id, group_id, release_id, version, state,
       traffic_percent, deployed_at)
    values (${checkoutApi}, ${prod}, ${commerce}, ${checkout}, ${release}, 'v1.43.0', 'canary',
      25, now())`;
  await sql`
    insert into pipeline_daily_rollups
      (application_id, day, runs, prod_deploys, failed_deploys, rollbacks, lead_time_p50_seconds)
    select ${checkoutApi}, current_date - n, 4, 2, case when n = 3 then 1 else 0 end, 0, 9600
    from generate_series(0, 6) as n`;
  const run =
    await one(sql`insert into pipeline_runs (trigger, ref, commit_sha, title, state, author_user_id)
      values ('push', 'main', 'a1c9e3f', 'Retry UPI collect', 'running', ${member}) returning id`);
  await sql`insert into pipeline_run_applications (run_id, application_id) values (${run}, ${checkoutApi})`;
  await sql`
    insert into pipeline_jobs (run_id, application_id, key, name, state)
    values (${run}, ${checkoutApi}, 'build', 'Build', 'running'),
      (${run}, ${checkoutApi}, 'unit-1', 'Unit 1 of 2', 'ready'),
      (${run}, ${checkoutApi}, 'unit-2', 'Unit 2 of 2', 'ready')`;
  await sql`
    insert into pipeline_deployments (release_id, application_id, environment_id, state)
    values (${release}, ${checkoutApi}, ${prod}, 'canary')`;
  return { teams: { payments, search }, applications };
}
