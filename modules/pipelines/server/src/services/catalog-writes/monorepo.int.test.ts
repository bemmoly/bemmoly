import type { RequestContext } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool } from '../../testing/execution.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';

/*
 * A monorepo in the Acme world with one repository file: three services built from one shared
 * Dockerfile with a SERVICE arg, a web app with its own Dockerfile and file, and a library
 * that is only checked. Pushes wake the applications they touch, each build gets its own
 * args, the library runs and makes no release, and leaving the list archives.
 */

const REPOSITORY = 'acme/shop';
const REPO_FILE = '.bemmoly/repository.yaml';
const STOREFRONT_FILE = 'apps/storefront/.bemmoly/application.yaml';

const repositoryFile = (services: string[]) => `
defaults:
  group: checkout
  owner: team/payments
  paths: ["packages/**"]
  build:
    dockerfile: docker/service.Dockerfile
    args: { SERVICE: "\${{ app.name }}", APP_DIR: "\${{ app.path }}" }
  pipeline:
    checkout: false
    test:
      - { name: Unit, image: "node:24", run: pnpm test }
applications:
${services.map((name) => `  - { name: ${name}, path: services/${name} }`).join('\n')}
  - name: money
    path: packages/money
    build: null
    labels: [library]
`;

const storefrontFile = `
name: storefront
tier: 1
pipeline:
  build:
    dockerfile: apps/storefront/Dockerfile
    context: apps/storefront
    args: { SERVICE: null, APP_DIR: null }
`;

const push = (after: string, files: string[]) => ({
  type: 'push' as const,
  repository: REPOSITORY,
  occurredAt: new Date().toISOString(),
  push: {
    branch: 'main',
    before: '0'.repeat(40),
    after,
    defaultBranch: 'main',
    isDefaultBranch: true,
    created: false,
    deleted: false,
    forced: false,
    changedFiles: files,
    truncated: false,
    commits: 1,
    pusher: 'priya',
  },
});

describe('a monorepo with a repository file', () => {
  let harness: PipelinesHarness | undefined;
  let reason = '';
  let system: RequestContext;
  let poolToken = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
    poolToken = (await createPool(harness.sql, 'linux-x64')).token;
    system = {
      ...harness.as(harness.users.admin),
      actor: { kind: 'system', id: 'code-host:test' },
    };
  });

  afterAll(async () => {
    await harness?.services.wakeups.stop();
    await harness?.stop();
  });

  const sync = (services: string[], sha: string) =>
    harness!.services.catalogWrites.applyApplicationFiles(system, {
      repository: { fullName: REPOSITORY, defaultBranch: 'main' },
      commitSha: sha,
      complete: true,
      files: [
        { path: REPO_FILE, content: repositoryFile(services) },
        { path: STOREFRONT_FILE, content: storefrontFile },
      ],
    });

  /** Which applications a push started, and each build's args. */
  const started = async (sha: string, files: string[]) => {
    const runId = await harness!.services.triggers.push(push(sha.repeat(40), files));
    if (!runId) return null;
    const jobs = await harness!.sql<
      { key: string; steps_spec: Array<{ env: Record<string, string> }> }[]
    >`
      select a.key, j.steps_spec from pipeline_jobs j
      join pipeline_applications a on a.id = j.application_id
      where j.run_id = ${runId} and j.kind = 'build' order by a.key`;
    const apps = await harness!.sql<{ key: string }[]>`
      select a.key from pipeline_run_applications r
      join pipeline_applications a on a.id = r.application_id
      where r.run_id = ${runId} order by a.key`;
    return {
      applications: apps.map((row) => row.key),
      args: Object.fromEntries(
        jobs.map((job) => {
          const args = job.steps_spec[0]?.env['BEMMOLY_BUILD_ARGS'];
          return [job.key, args ? (JSON.parse(args) as Record<string, string>) : null];
        }),
      ),
    };
  };

  it('applies the central list, the web app’s own file and the defaults', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const result = await sync(['orders', 'invoices', 'shipping'], 'a1');
    expect(result.problems).toEqual([]);
    expect(result.applied.sort()).toEqual([
      'invoices',
      'money',
      'orders',
      'shipping',
      'storefront',
    ]);
    const rows = await harness.sql<
      { key: string; path: string; paths: string[]; file_path: string; settings_sources: unknown }[]
    >`
      select key, path, paths, file_path, settings_sources from pipeline_applications
      where key in ('orders', 'storefront', 'money') order by key`;
    expect(rows).toEqual([
      {
        key: 'money',
        path: 'packages/money',
        paths: ['packages/**'],
        file_path: REPO_FILE,
        settings_sources: {
          file: REPO_FILE,
          fields: expect.objectContaining({
            name: 'central',
            labels: 'central',
            group: 'defaults',
          }),
        },
      },
      expect.objectContaining({ key: 'orders', path: 'services/orders', file_path: REPO_FILE }),
      {
        key: 'storefront',
        path: 'apps/storefront',
        paths: ['packages/**'],
        file_path: STOREFRONT_FILE,
        settings_sources: {
          file: STOREFRONT_FILE,
          fields: expect.objectContaining({
            name: 'file',
            tier: 'file',
            build: 'file',
            owner: 'defaults',
            pipeline: 'defaults',
          }),
        },
      },
    ]);
  });

  it('starts the applications each push touches, each build with its own args', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    expect(await started('b', ['services/orders/src/main.ts'])).toEqual({
      applications: ['orders'],
      args: { orders: { SERVICE: 'orders', APP_DIR: 'services/orders' } },
    });
    expect(await started('c', ['apps/storefront/src/app.tsx'])).toEqual({
      applications: ['storefront'],
      args: { storefront: null },
    });
    const shared = await started('d', ['packages/money/src/round.ts']);
    expect(shared?.applications).toEqual(['invoices', 'money', 'orders', 'shipping', 'storefront']);
    expect(shared?.args).toEqual({
      invoices: { SERVICE: 'invoices', APP_DIR: 'services/invoices' },
      orders: { SERVICE: 'orders', APP_DIR: 'services/orders' },
      shipping: { SERVICE: 'shipping', APP_DIR: 'services/shipping' },
      storefront: null,
    });
    expect(await started('e', ['docs/readme.md'])).toBeNull();
  });

  it('runs the library, makes it no release and says so on its page', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { services, users } = harness;
    const member = harness.as(users.member);
    const run = await services.runs.create(member, { application: 'money', commitSha: 'f1f1f1f1' });
    const { runnerToken } = await services.runner.register({
      poolToken,
      name: 'checker',
      version: '0.1.0',
    });
    for (;;) {
      const job = await services.runner.claim(runnerToken, { waitSeconds: 0 });
      if (!job) break;
      // Earlier pushes queued jobs too; the library's own have no build.
      if (job.runId === run.id) expect(job.steps.map((step) => step.uses)).toEqual([null]);
      await services.runner.finish(job.jobId, job.jobToken, {
        state: 'passed',
        at: new Date().toISOString(),
      });
    }
    const [row] = await harness.sql<{ state: string }[]>`
      select state from pipeline_runs where id = ${run.id}`;
    expect(row?.state).toBe('passed');
    expect(await services.releaseFrom(run.id)).toBe(0);
    const page = await services.runs.pipeline(member, 'money');
    expect(page).toMatchObject({ library: true, settings: { file: REPO_FILE } });
    expect((await services.runs.pipeline(member, 'orders')).library).toBe(false);
  });

  it('archives an application that leaves the central list', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const result = await sync(['orders', 'invoices'], 'f2');
    expect(result.archived).toEqual(['shipping']);
    const [row] = await harness.sql<{ archived: boolean }[]>`
      select archived_at is not null as archived from pipeline_applications where key = 'shipping'`;
    expect(row?.archived).toBe(true);
    expect(await started('g', ['services/shipping/src/main.ts'])).toBeNull();
  });
});
