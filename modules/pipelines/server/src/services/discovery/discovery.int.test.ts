import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { proposalsPageSchema } from '../../../../shared/catalog-writes.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import { createCatalogWritesService } from '../catalog-writes/index.ts';
import type { PullRequestInput } from '../code/pull-requests.ts';
import { fixtureTree } from './fixture-tree.ts';
import { createDiscoveryService } from './index.ts';

const fixture = (name: string) => fileURLToPath(new URL(`./testdata/${name}`, import.meta.url));

describe('discovery proposals', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let reason = '';
  const opened: PullRequestInput[] = [];

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

  const admin = () => harness?.users.admin ?? '';
  const member = () => harness?.users.member ?? '';
  const withHost = () => {
    if (!harness) throw new Error('no harness');
    const deps = { database: harness.sql, access: harness.services.access };
    const writes = createCatalogWritesService({
      ...deps,
      pullRequests: {
        openPullRequest: async (input) => {
          opened.push(input);
          return { url: `https://github.com/${input.repository}/pull/${opened.length}` };
        },
      },
    });
    return createDiscoveryService(deps, writes);
  };

  it('proposes what a scan finds, with owners matched to teams', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const tree = await fixtureTree(fixture('monorepo'), 'c0ffee1');
    const result = await harness.services.discovery.discover({ fullName: 'acme/shop' }, tree);
    expect(result).toEqual({ repository: 'acme/shop', proposed: 2, removed: 0 });
    const page = proposalsPageSchema.parse(
      (await http.get('/discovery/proposals', member())).json(),
    );
    expect(page.total).toBe(2);
    expect(page.items[0]).toMatchObject({
      key: 'checkout-api',
      runtime: 'kubernetes',
      owner: { raw: '@acme/payments', source: 'codeowners', team: { name: 'Payments' } },
    });
    expect(page.items[1]?.owner).toMatchObject({ raw: '@acme/platform', team: null });
  });

  it('accepts in bulk, reports what failed and opens one pull request per repository', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const page = proposalsPageSchema.parse(
      (await http.get('/discovery/proposals', member())).json(),
    );
    const [api, web] = page.items;
    const service = withHost();
    expect(
      (
        await http.send('POST', '/discovery/acceptances', member(), {
          items: [{ id: api?.id }],
          group: 'commerce/checkout',
        })
      ).statusCode,
    ).toBe(403);
    const result = await service.accept(harness.as(admin()), {
      items: [{ id: api?.id ?? '' }, { id: web?.id ?? '', key: 'shop-web' }],
      group: 'commerce/checkout',
      openPullRequests: true,
    });
    // checkout-api is already in the catalog, so only the web app is created.
    expect(result.failed).toEqual([
      { proposal: api?.id, message: 'An application called "checkout-api" already exists' },
    ]);
    expect(result.created).toEqual([{ proposal: web?.id, application: 'shop-web' }]);
    expect(result.pullRequests).toEqual([
      { repository: 'acme/shop', url: 'https://github.com/acme/shop/pull/1', pending: false },
    ]);
    expect(opened[0]?.files).toEqual([
      {
        path: 'apps/web/.bemmoly/application.yaml',
        content: expect.stringContaining('name: shop-web\ngroup: checkout\ndomain: commerce\n'),
      },
    ]);
    const app = await http.get('/applications/shop-web', member());
    expect(app.json()).toMatchObject({ path: 'apps/web', repository: { fullName: 'acme/shop' } });
  });

  it('dismisses proposals and never brings back what a person decided', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const page = proposalsPageSchema.parse(
      (await http.get('/discovery/proposals', member())).json(),
    );
    const dismissed = await http.send('POST', '/discovery/dismissals', admin(), {
      ids: page.items.map((p) => p.id),
    });
    expect(dismissed.json()).toEqual({ dismissed: 1 });
    const tree = await fixtureTree(fixture('monorepo'), 'c0ffee2');
    const again = await harness.services.discovery.discover({ fullName: 'acme/shop' }, tree);
    expect(again.removed).toBe(0);
    const left = proposalsPageSchema.parse(
      (await http.get('/discovery/proposals', member())).json(),
    );
    expect(left.total).toBe(0);
  });

  it('proposes one repository file for folders that share a Dockerfile, and opens it', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const tree = await fixtureTree(fixture('shared-dockerfile'), 'c0ffee3');
    const scanned = await harness.services.discovery.discover({ fullName: 'acme/market' }, tree);
    expect(scanned.proposed).toBe(4);
    const page = proposalsPageSchema.parse(
      (await http.get('/discovery/proposals', member(), { repository: 'acme/market' })).json(),
    );
    expect(page.repositoryFiles).toEqual([
      {
        repository: 'acme/market',
        path: '.bemmoly/repository.yaml',
        content: expect.stringContaining('dockerfile: docker/service.Dockerfile'),
      },
    ]);
    expect(page.repositoryFiles[0]?.content).toContain(
      '  - name: orders\n    path: services/orders\n',
    );
    const before = opened.length;
    const result = await withHost().accept(harness.as(admin()), {
      items: page.items.map((item) => ({ id: item.id })),
      group: 'commerce/checkout',
      openPullRequests: true,
    });
    expect(result.created.map((item) => item.application).sort()).toEqual([
      'invoices',
      'orders',
      'shipping',
      'storefront',
    ]);
    const files = opened[before]?.files ?? [];
    expect(files.map((file) => file.path)).toEqual([
      'apps/storefront/.bemmoly/application.yaml',
      '.bemmoly/repository.yaml',
    ]);
    expect(files[1]?.content).toContain(
      'defaults:\n  group: checkout\n  domain: commerce\n  build:\n    dockerfile: docker/service.Dockerfile\n    args:\n      SERVICE: ${{ app.name }}\n',
    );
    const changes = await harness.sql<{ file_path: string }[]>`
      select c.file_path from pipeline_catalog_changes c
      join pipeline_applications a on a.id = c.application_id where a.key = 'orders'`;
    expect(changes).toEqual([{ file_path: '.bemmoly/repository.yaml' }]);
  });

  it('says how to connect the code host when it cannot read a repository', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await http.send('POST', '/discovery/scans', admin(), {
      repository: { fullName: 'acme/other' },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(500);
    expect(response.json().message).toContain('Connect the code host in Settings');
  });
});
