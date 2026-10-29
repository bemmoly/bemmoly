import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedCatalogFixture, type CatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import { readZip } from '../../testing/read-zip.ts';

/*
 * Export end to end against real Postgres and the cloud simulator: a Starter landing zone
 * applied, checkout-api deployed to Dev with a secret set from the screen, then the bundle
 * previewed and downloaded. The zip holds the landing zone, the service and the secret's name
 * and version, and never the secret's value.
 */

const SENTINEL = 'sentinel-7d1e44b0-export-test-value';
const DIGEST = 'sha256:0d3f9a1c7e5b2d4f6a8c0e1b3d5f7a9c2e4b6d8f0a1c3e5b7d9f1a3c5e7b9d0f';

let harness: PipelinesHarness | undefined;
let http: PipelinesHttp | undefined;
let catalog: CatalogFixture | undefined;
let skip = '';

beforeAll(async () => {
  const started = await startPipelinesHarness();
  if (!started.available) {
    skip = started.reason;
    return;
  }
  harness = started.harness;
  http = await startPipelinesHttp(harness);
  catalog = await seedCatalogFixture(harness.sql, harness.users.member);
});

afterAll(async () => {
  await http?.app.close();
  await harness?.stop();
});

const ready = () => {
  if (!harness || !http || !catalog) throw new Error('no harness');
  return { h: harness, api: http, app: catalog.applications['checkout-api'] ?? '' };
};

/** A Starter landing zone made through the simulator, as Platform › Clouds makes it. */
async function applyStarter(h: PipelinesHarness) {
  const admin = h.as(h.users.admin);
  const clouds = h.services.clouds;
  const connection = await clouds.connect(admin, {
    provider: 'gcp',
    name: 'Acme Starter',
    layout: 'starter',
    mode: 'managed',
    signIn: 'vm',
    region: 'us-central1',
    folderId: '417302018845',
    folderName: 'Bemmoly',
    billingAccountId: '01A2B3-C4D5E6-F7A8B9',
    controlProject: 'bemmoly-control-583920174411',
  });
  await clouds.check(admin, connection.id);
  const plan = await clouds.plan(admin, connection.id, {});
  await clouds.apply(admin, connection.id, { planId: plan.planId, specHash: plan.specHash });
  const applied = await clouds.runApply(plan.planId);
  expect(applied.failed).toEqual([]);
  return connection.id;
}

/** checkout-api's v2.0.0 serving Dev, deployed with the variables Dev has now. */
async function serveInDev(h: PipelinesHarness, app: string) {
  const [dev] = await h.sql<
    { id: string }[]
  >`select id from pipeline_environments where key = 'dev'`;
  const env = dev?.id ?? '';
  const [release] = await h.sql<{ id: string }[]>`
    insert into pipeline_releases
      (application_id, version, commit_sha, image_repository, image_digests, resolved_config)
    values (${app}, 'v2.0.0', 'c0ffee1',
      'us-central1-docker.pkg.dev/bemmoly-control-583920174411/apps/checkout-api',
      ${JSON.stringify({ 'linux/amd64': DIGEST })}::jsonb,
      '{"deploy": {"port": 8080, "public": true}}'::jsonb)
    returning id`;
  const variables = await h.services.variables.forDeploy(app, env);
  const [deployment] = await h.sql<{ id: string }[]>`
    insert into pipeline_deployments
      (release_id, application_id, environment_id, state, phase, revision, variables, finished_at)
    values (${release?.id ?? ''}, ${app}, ${env}, 'succeeded', 'done',
      'checkout-api-v2-0-0-c0ffee1', ${JSON.stringify(variables)}::jsonb, now())
    returning id`;
  await h.sql`
    insert into pipeline_current (application_id, environment_id, domain_id, group_id, release_id,
      version, deployment_id, state, traffic_percent, deployed_at)
    select ${app}, ${env}, a.domain_id, a.group_id, ${release?.id ?? ''}, 'v2.0.0',
      ${deployment?.id ?? ''}, 'idle', 100, now()
    from pipeline_applications a where a.id = ${app}`;
}

describe('exporting what Pipelines made', () => {
  let connection = '';

  it('previews one directory per connection, saying what it left out', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api, app } = ready();
    connection = await applyStarter(h);
    const set = await api.send(
      'PUT',
      '/applications/checkout-api/variables/DB_URL?environment=dev',
      h.users.admin,
      { kind: 'secret', value: SENTINEL },
    );
    expect(set.statusCode, set.body).toBeLessThan(300);
    await serveInDev(h, app);

    const preview = await api.get('/exports', h.users.admin);
    expect(preview.statusCode, preview.body).toBe(200);
    const body = preview.json();
    const starter = body.items.find(
      (item: { connection: { id: string } }) => item.connection.id === connection,
    );
    expect(starter).toMatchObject({
      directory: 'acme-starter',
      connection: { name: 'Acme Starter', mode: 'managed' },
      counts: { projects: 2, services: 1, charts: 0, secrets: 1 },
    });
    expect(starter.files).toEqual(
      expect.arrayContaining([
        'acme-starter/README.md',
        'acme-starter/terraform/landing-zone.tf',
        'acme-starter/terraform/cloud-run.tf',
        'acme-starter/terraform/imports.tf',
      ]),
    );
    expect(starter.toFill).toEqual([]);
    // The fixture's Prod canary has no revision on record, so it cannot be adopted.
    expect(body.leftOut).toContain(
      'checkout-api in prod-asia-south1: Pipelines has no record of the revision serving it.',
    );
  });

  it('downloads a zip that adopts the service and names its secret, never its value', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const response = await api.get('/exports/archive', h.users.admin);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/zip');
    expect(response.headers['content-disposition']).toMatch(
      /bemmoly-pipelines-export-\d{4}-\d{2}-\d{2}\.zip/,
    );
    const files = readZip(response.rawPayload);
    expect(Object.keys(files)).toContain('README.md');
    const run = files['acme-starter/terraform/cloud-run.tf'] ?? '';
    expect(run).toContain(`checkout-api@${DIGEST}`);
    expect(run).toMatch(/secret += "bemmoly-checkout-api-DB_URL-dev"\n +version = "1"/);
    expect(files['acme-starter/terraform/secrets.tf']).toContain(
      'secret_id = "bemmoly-checkout-api-DB_URL-dev"',
    );
    expect(files['acme-starter/terraform/imports.tf']).toContain('/services/checkout-api"');
    for (const [name, content] of Object.entries(files)) {
      expect(content.includes(SENTINEL), `${name} holds the secret's value`).toBe(false);
    }
    expect(response.rawPayload.includes(Buffer.from(SENTINEL))).toBe(false);
  });

  it("exports one application's services alone", async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const response = await api.get('/exports/archive', h.users.admin, {
      application: 'checkout-api',
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-disposition']).toContain('export-checkout-api-');
    const names = Object.keys(readZip(response.rawPayload));
    expect(names).toContain('acme-starter/terraform/cloud-run.tf');
    expect(names).not.toContain('acme-starter/terraform/landing-zone.tf');
    const missing = await api.get('/exports', h.users.admin, { application: 'gift-cards' });
    expect(missing.statusCode).toBe(404);
  });

  it('is for platform admins only', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    expect((await api.get('/exports/archive', h.users.member)).statusCode).toBe(403);
    expect((await api.get('/exports', h.users.outsider)).statusCode).toBe(403);
  });
});
