import { createChangelogRunner, loadKernelChangelog } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pipelines from '../../../../module.ts';
import { createPool, givePipeline } from '../../testing/execution.ts';
import { seedCatalogFixture, type CatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import { attachSecretsPlace, columnsHolding } from '../../testing/variables-fixture.ts';

/*
 * Secrets after they are set: values from before secrets existed moved out by the sweep, a
 * deploy mounting the environment's value over the shared one at its recorded version, a roll
 * back redeploying the set a release ran with, and a CI job collecting its secrets once.
 */

const LEGACY = 'sentinel-c4a19e02-legacy-test-value';
const APP = '/applications/checkout-api/variables';

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
  await harness?.services.wakeups.stop();
  await http?.app.close();
  await harness?.stop();
});

const ready = () => {
  if (!harness || !http || !catalog) throw new Error('no harness');
  return { h: harness, api: http, app: catalog.applications['checkout-api'] ?? '' };
};

const envId = async (h: PipelinesHarness, key: string) =>
  (await h.sql<{ id: string }[]>`select id from pipeline_environments where key = ${key}`)[0]?.id ??
  '';

describe('values from before secrets existed', () => {
  it('are marked as secrets waiting to move when the changeset runs', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, app } = ready();
    const runner = createChangelogRunner({
      sql: h.sql,
      kernel: await loadKernelChangelog(),
      modules: [{ module: 'pipelines', changelog: pipelines.changelog }],
      appVersion: '0.1.0',
    });
    // Back to before secrets existed, past any changeset that came after them.
    const secrets = pipelines.changelog.findIndex((changeset) => changeset.id.startsWith('0021-'));
    await runner.rollback('pipelines', { count: pipelines.changelog.length - secrets });
    const dev = await envId(h, 'dev');
    const staging = await envId(h, 'staging');
    await h.sql`
      insert into pipeline_variables (application_id, environment_id, name, value)
      values (${app}, ${dev}, 'OLD_TOKEN', ${LEGACY}), (${app}, ${staging}, 'OLD_TOKEN', ${LEGACY})`;
    await runner.update({ contexts: ['production'] });
    const rows = await h.sql<{ kind: string; problem: string }[]>`
      select kind, problem from pipeline_variables where name = 'OLD_TOKEN'`;
    expect(rows).toEqual([
      { kind: 'secret', problem: 'Waiting to move into the secret store' },
      { kind: 'secret', problem: 'Waiting to move into the secret store' },
    ]);
  });

  it('move into the store with the sweep, and one that cannot says why', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    // No cloud yet: nothing can move, and each row says what to do.
    expect(await h.services.variables.moveUnmoved()).toEqual({ moved: 0, waiting: 2 });
    const [waiting] = await h.sql<{ problem: string }[]>`
      select problem from pipeline_variables where name = 'OLD_TOKEN' limit 1`;
    expect(waiting?.problem).toMatch(/Connect one in Platform › Clouds/);

    await attachSecretsPlace(h, api);
    expect(await h.services.variables.moveUnmoved()).toEqual({ moved: 1, waiting: 1 });
    const listed = (await api.get(APP, h.users.admin)).json();
    expect(listed.items).toEqual([
      expect.objectContaining({
        environment: expect.objectContaining({ key: 'dev' }),
        state: 'set',
        version: 1,
      }),
      expect.objectContaining({
        environment: expect.objectContaining({ key: 'staging' }),
        state: 'moving',
        problem:
          'staging has no project yet. Choose one in Platform › Environments, then set the secret again',
      }),
    ]);
    expect(h.world.secrets.get('acme-shop-dev/bemmoly-checkout-api-OLD_TOKEN-dev')).toHaveLength(1);
    await h.sql`delete from pipeline_variables where environment_id = ${await envId(h, 'staging')}`;
    expect((await columnsHolding(h, LEGACY)).found).toEqual([]);
  });
});

async function deploy(h: PipelinesHarness, app: string, release: string, previous?: string) {
  const [row] = await h.sql<{ id: string }[]>`
    insert into pipeline_deployments
      (release_id, application_id, environment_id, state, phase, previous_release_id)
    values (${release}, ${app}, ${await envId(h, 'dev')}, 'pending', 'deploy', ${previous ?? null})
    returning id`;
  const id = row?.id ?? '';
  await h.services.shipping?.engine.advance('deployment', id);
  const [done] = await h.sql<{ revision: string; variables: unknown; message: string | null }[]>`
    select d.revision, d.variables, (select message from pipeline_deployment_events e
      where e.deployment_id = d.id order by e.created_at desc limit 1) as message
    from pipeline_deployments d where d.id = ${id}`;
  if (!done?.revision) throw new Error(`The deploy did not happen: ${done?.message ?? ''}`);
  await h.sql`update pipeline_deployments set state = 'succeeded', finished_at = now() where id = ${id}`;
  return { id, revision: done.revision, variables: done.variables };
}

describe('deploys and roll backs', () => {
  const releases: string[] = [];

  it('mount the environment’s value over the shared one, at its recorded version', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api, app } = ready();
    const put = (path: string, kind: string, value: string) =>
      api.send('PUT', `${APP}/${path}`, h.users.admin, { kind, value });
    await put('LOG_LEVEL', 'plain', 'info');
    await put('LOG_LEVEL?environment=dev', 'plain', 'debug');
    await put('API_KEY', 'secret', 'shared-test-value');
    await put('DB_URL?environment=dev', 'secret', 'dev-test-value-1');
    for (const version of ['v1', 'v2']) {
      const [row] = await h.sql<{ id: string }[]>`
        insert into pipeline_releases (application_id, version, commit_sha)
        values (${app}, ${version}, ${`c0ffee${version}`}) returning id`;
      releases.push(row?.id ?? '');
    }
    const first = await deploy(h, app, releases[0] ?? '');
    const expected = [
      {
        name: 'API_KEY',
        kind: 'secret',
        account: 'acme-shop-ci',
        secret: 'bemmoly-checkout-api-API_KEY',
        version: '1',
      },
      {
        name: 'DB_URL',
        kind: 'secret',
        account: 'acme-shop-dev',
        secret: 'bemmoly-checkout-api-DB_URL-dev',
        version: '1',
      },
      { name: 'LOG_LEVEL', kind: 'plain', value: 'debug' },
      {
        name: 'OLD_TOKEN',
        kind: 'secret',
        account: 'acme-shop-dev',
        secret: 'bemmoly-checkout-api-OLD_TOKEN-dev',
        version: '1',
      },
    ];
    expect(first.variables).toEqual(expected);
    const revision = h.world.targets.get('checkout-api@dev')?.revisions.get(first.revision);
    expect(revision?.variables).toEqual(expected);
  });

  it('redeploy a release with the set it ran with when its revision is gone', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api, app } = ready();
    const first = await h.sql<{ id: string; revision: string }[]>`
      select id, revision from pipeline_deployments where release_id = ${releases[0] ?? ''}`;
    await api.send('PUT', `${APP}/DB_URL?environment=dev`, h.users.admin, {
      kind: 'secret',
      value: 'dev-test-value-2',
    });
    const second = await deploy(h, app, releases[1] ?? '', releases[0]);
    expect(second.variables).toContainEqual(
      expect.objectContaining({ name: 'DB_URL', version: '2' }),
    );
    await h.sql`
      insert into pipeline_current (application_id, environment_id, domain_id, group_id, release_id,
        version, deployment_id, state, traffic_percent)
      select ${app}, ${await envId(h, 'dev')}, a.domain_id, a.group_id, ${releases[1] ?? ''}, 'v2',
        ${second.id}, 'idle', 100 from pipeline_applications a where a.id = ${app}
      on conflict (application_id, environment_id) do update set deployment_id = excluded.deployment_id`;
    h.world.targets.get('checkout-api@dev')?.revisions.delete(first[0]?.revision ?? '');
    await h.services.shipping?.rollback(h.as(h.users.admin), second.id, { reason: 'Bad v2' });
    const [back] = await h.sql<{ state: string; revision: string; variables: unknown }[]>`
      select state, revision, variables from pipeline_deployments
      where kind = 'rollback' order by created_at desc limit 1`;
    expect(back?.state).toBe('succeeded');
    expect(back?.variables).toContainEqual(
      expect.objectContaining({ name: 'DB_URL', version: '1' }),
    );
    const mounted = h.world.targets.get('checkout-api@dev')?.revisions.get(back?.revision ?? '');
    expect(mounted?.variables).toContainEqual(
      expect.objectContaining({ name: 'DB_URL', version: '1' }),
    );
  });
});

describe('a CI job’s secrets', () => {
  it('come from the store once, before the first step, and never to a fork', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    await api.send('PUT', `${APP}/NPM_TOKEN`, h.users.admin, {
      kind: 'secret',
      value: 'ci-test-value',
    });
    await givePipeline(h.sql, 'checkout-api', {
      checkout: false,
      test: [{ name: 'Unit', run: 'npm ci', secrets: ['NPM_TOKEN', 'API_KEY'] }],
    });
    const { token } = await createPool(h.sql, 'linux-x64');
    const run = await h.services.runs.create(h.as(h.users.member), {
      application: 'checkout-api',
      commitSha: 'feedface',
    });
    const { runnerToken } = await h.services.runner.register({
      poolToken: token,
      name: 'ci',
      version: '0.1.0',
    });
    const job = await h.services.runner.claim(runnerToken, { waitSeconds: 0 });
    expect(await h.services.runner.secrets(job?.jobId ?? '', job?.jobToken)).toEqual({
      values: { NPM_TOKEN: 'ci-test-value', API_KEY: 'shared-test-value' },
    });
    await h.services.runner.finish(job?.jobId ?? '', job?.jobToken, {
      state: 'passed',
      at: new Date().toISOString(),
    });
    await h.sql`update pipeline_runs set from_fork = true where id = ${run.id}`;
    await h.services.runs.rerun(h.as(h.users.member), run.id, { only: 'all' });
    const fork = await h.services.runner.claim(runnerToken, { waitSeconds: 0 });
    expect(await h.services.runner.secrets(fork?.jobId ?? '', fork?.jobToken)).toEqual({
      values: {},
    });
  });
});
