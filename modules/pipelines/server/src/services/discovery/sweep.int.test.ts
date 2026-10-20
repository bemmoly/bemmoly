import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { discoveryStatusSchema } from '../../../../shared/discovery.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import { createCatalogWritesService } from '../catalog-writes/index.ts';
import type { RepositoryReader, VisibleRepository } from '../code/repository-reader.ts';
import { fixtureTree } from './fixture-tree.ts';
import { createDiscoveryService, DISCOVERY_SWEEP_JOB } from './index.ts';

/*
 * Connecting GitHub is enough: a sweep lists what the hosts let Pipelines read, scans the
 * repositories it has not seen, and the status counts how far it got.
 */

const fixture = (name: string) => fileURLToPath(new URL(`./testdata/${name}`, import.meta.url));

const visible = (fullName: string, defaultBranch: string): VisibleRepository => ({
  fullName,
  provider: 'github',
  defaultBranch,
  url: `https://github.com/${fullName}`,
});

describe('discovery sweeps', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let reason = '';
  const reads: string[] = [];
  let listed: VisibleRepository[] | null = [
    visible('acme/shop', 'main'),
    visible('acme/platform', 'trunk'),
    visible('acme/locked', 'main'),
  ];

  const reader: RepositoryReader = {
    visible: async () => listed,
    async tree(repository, ref) {
      reads.push(`${repository}@${ref}`);
      if (repository === 'acme/shop') return fixtureTree(fixture('monorepo'), 'c0ffee1');
      if (repository === 'acme/platform') return fixtureTree(fixture('polyglot'), 'beef002');
      return null;
    },
  };

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
    http = await startPipelinesHttp(harness);
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  const discovery = () => {
    if (!harness) throw new Error('no harness');
    const deps = { database: harness.sql, access: harness.services.access };
    return createDiscoveryService(
      deps,
      createCatalogWritesService({ ...deps, repositories: reader }),
    );
  };
  const status = async () =>
    discoveryStatusSchema.parse(
      (await http.get('/discovery/status', harness?.users.member ?? '')).json(),
    );

  it('has nothing to report before the first sweep', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    expect(await status()).toEqual({
      repositories: 0,
      scanned: 0,
      failed: 0,
      scanning: false,
      lastSweep: null,
    });
  });

  it('scans every repository the hosts list, on its own default branch', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    expect(await discovery().sweep(false)).toEqual({ repositories: 3, queued: 3 });
    expect(reads.sort()).toEqual(['acme/locked@main', 'acme/platform@trunk', 'acme/shop@main']);
    const now = await status();
    expect(now).toMatchObject({ repositories: 3, scanned: 2, failed: 1, scanning: false });
    expect(now.lastSweep).toMatchObject({ repositories: 3, error: null });
    const proposals = (await http.get('/discovery/proposals', harness.users.member)).json();
    expect(proposals.total).toBeGreaterThan(2);
    const [locked] = await harness.sql<{ discovery_error: string }[]>`
      select discovery_error from pipeline_repositories where full_name = 'acme/locked'`;
    expect(locked?.discovery_error).toMatch(/cannot read acme\/locked/);
  });

  it('leaves what it has seen alone until asked to look again', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    reads.length = 0;
    listed = [...(listed ?? []), visible('acme/new', 'main')];
    expect(await discovery().sweep(false)).toEqual({ repositories: 4, queued: 1 });
    expect(reads).toEqual(['acme/new@main']);
    reads.length = 0;
    expect(await discovery().sweep(true)).toEqual({ repositories: 4, queued: 4 });
    expect(reads).toHaveLength(4);
    expect(await status()).toMatchObject({ repositories: 4, scanned: 2, failed: 2 });
  });

  it('says so when no code host is connected', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    listed = null;
    expect(await discovery().sweep(false)).toEqual({ repositories: 0, queued: 0 });
    expect((await status()).lastSweep?.error).toMatch(/Connect GitHub/);
  });

  it('queues a sweep of everything when an admin asks, and only an admin', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const refused = await http.send('POST', '/discovery/scans', harness.users.member, {});
    expect(refused.statusCode).toBe(403);
    const asked = await http.send('POST', '/discovery/scans', harness.users.admin, {});
    expect(asked.statusCode).toBe(201);
    expect(asked.json()).toEqual({ queued: true });
    expect(harness.jobs.at(-1)).toMatchObject({
      name: DISCOVERY_SWEEP_JOB,
      payload: { rescan: true },
    });
  });
});
