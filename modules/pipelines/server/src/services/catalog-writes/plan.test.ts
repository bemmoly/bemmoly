import { describe, expect, it } from 'vitest';
import { planCatalogFiles } from './plan.ts';

/*
 * The repository file's precedence: a folder's own application.yaml beats its central entry,
 * which beats `defaults`. Lists add up, everything else is replaced, null removes, and an
 * error names the file and the field it came from.
 */

const REPO = '.bemmoly/repository.yaml';

const repositoryFile = `
defaults:
  group: shop
  owner: team/platform
  labels: [node]
  paths: ["packages/**"]
  build:
    dockerfile: docker/service.Dockerfile
    args: { SERVICE: "\${{ app.name }}" }
  pipeline:
    test:
      - { name: Unit, image: "node:24", run: pnpm test }
applications:
  - { name: orders, path: services/orders, tier: 1 }
  - { name: billing, path: services/billing, labels: [pci] }
  - name: storefront
    path: apps/storefront
    build: { dockerfile: apps/storefront/Dockerfile, context: apps/storefront }
  - { name: money, path: packages/money, build: null, paths: [] }
`;

const ordersFile = `
owner: team/orders
labels: [grpc]
pipeline:
  build: { args: { MODE: release } }
`;

const plan = (files: Array<[string, string | null]>, complete = true) =>
  planCatalogFiles(
    files.map(([path, content]) => ({ path, content })),
    complete,
  );

describe('planCatalogFiles', () => {
  it('merges defaults, the central entry and the folder’s own file in that order', () => {
    const result = plan([
      [REPO, repositoryFile],
      ['services/orders/.bemmoly/application.yaml', ordersFile],
    ]);
    expect(result.problems).toEqual([]);
    const byName = new Map(result.applications.map((app) => [app.file.name, app]));
    expect([...byName.keys()].sort()).toEqual(['billing', 'money', 'orders', 'storefront']);
    const orders = byName.get('orders');
    expect(orders).toMatchObject({
      path: 'services/orders/.bemmoly/application.yaml',
      folder: 'services/orders',
      file: {
        group: 'shop',
        owner: 'team/orders',
        tier: 1,
        labels: ['node', 'grpc'],
        paths: ['packages/**'],
        pipeline: {
          build: {
            dockerfile: 'docker/service.Dockerfile',
            args: { SERVICE: '${{ app.name }}', MODE: 'release' },
          },
        },
      },
      fields: {
        group: 'defaults',
        owner: 'file',
        tier: 'central',
        labels: 'file',
        paths: 'defaults',
        build: 'file',
        pipeline: 'defaults',
        name: 'central',
      },
    });
    expect(byName.get('billing')).toMatchObject({
      path: REPO,
      file: { labels: ['node', 'pci'], owner: 'team/platform' },
    });
    expect(byName.get('storefront')?.file.pipeline).toMatchObject({
      build: { dockerfile: 'apps/storefront/Dockerfile', context: 'apps/storefront' },
    });
  });

  it('lets a library turn the shared build off and keeps its checks', () => {
    const money = plan([[REPO, repositoryFile]]).applications.find(
      (app) => app.file.name === 'money',
    );
    expect(money?.file.pipeline).not.toHaveProperty('build');
    expect(money?.file.pipeline).toMatchObject({ test: [{ name: 'Unit' }] });
    expect(money?.fields).not.toHaveProperty('build');
    // Lists add up, so an empty list keeps the defaults' paths.
    expect(money?.file.paths).toEqual(['packages/**']);
  });

  it('archives entries that left the list, and falls back to the entry when a file goes', () => {
    expect(plan([[REPO, repositoryFile]]).keepCentral).toEqual([
      'orders',
      'billing',
      'storefront',
      'money',
    ]);
    const deleted = plan(
      [
        [REPO, repositoryFile],
        ['services/orders/.bemmoly/application.yaml', null],
        ['services/legacy/.bemmoly/application.yaml', null],
      ],
      false,
    );
    expect(deleted.archiveFiles).toEqual(['services/legacy/.bemmoly/application.yaml']);
    expect(deleted.applications.map((app) => [app.file.name, app.path])).toEqual([
      ['orders', REPO],
    ]);
    expect(deleted.keepCentral).toBeNull();
    expect(plan([[REPO, null]]).keepCentral).toEqual([]);
  });

  it('keeps an application.yaml on its own when there is no repository file', () => {
    const result = plan(
      [['apps/web/.bemmoly/application.yaml', 'name: web\ngroup: shop\n']],
      false,
    );
    expect(result.applications[0]).toMatchObject({
      folder: 'apps/web',
      file: { name: 'web', group: 'shop', paths: [] },
      fields: { name: 'file', group: 'file' },
    });
  });

  it('names the file and the field of an error', () => {
    const bad = plan([
      [
        REPO,
        'defaults: { group: Shop }\napplications:\n  - { name: orders, path: services/orders }\n',
      ],
    ]);
    expect(bad.problems).toEqual([
      {
        path: REPO,
        message: 'defaults.group: Use lowercase letters, digits and dashes',
        applied: false,
      },
    ]);
    const missing = plan([[REPO, 'applications:\n  - { name: orders, path: services/orders }\n']]);
    expect(missing.problems[0]?.message).toMatch(/^applications\.0\.group: /);
    const own = plan([
      [REPO, repositoryFile],
      ['services/orders/.bemmoly/application.yaml', 'tier: 7\n'],
    ]);
    expect(own.problems[0]).toMatchObject({
      path: 'services/orders/.bemmoly/application.yaml',
      message: expect.stringMatching(/^tier: /),
    });
  });

  it('holds every file while the repository file is broken', () => {
    const result = plan([
      [REPO, 'defaults: { colour: blue }\n'],
      ['apps/web/.bemmoly/application.yaml', 'name: web\ngroup: shop\n'],
    ]);
    expect(result.applications).toEqual([]);
    expect(result.keepCentral).toBeNull();
    expect(result.problems.map((problem) => problem.path)).toEqual([
      REPO,
      'apps/web/.bemmoly/application.yaml',
    ]);
    expect(result.problems[0]?.message).toMatch(/colour/);
    const twice = plan([
      [REPO, 'applications:\n  - { name: a, path: x }\n  - { name: a, path: y }\n'],
    ]);
    expect(twice.problems[0]?.message).toBe(
      'applications.1.name: a is listed twice; application names are unique',
    );
  });
});
