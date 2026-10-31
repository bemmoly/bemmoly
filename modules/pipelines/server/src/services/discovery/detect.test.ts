import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { detectApplications } from './detect.ts';
import { fixtureTree } from './fixture-tree.ts';
import { compileGlob, ownersOf, parseCodeowners } from './globs.ts';
import { cargoMembers, goWorkUses, gradleIncludes } from './manifests.ts';

const fixture = (name: string) => fileURLToPath(new URL(`./testdata/${name}`, import.meta.url));

describe('discovery in a pnpm and Turborepo monorepo', () => {
  it('proposes the members that run, folds their chart in and reads CODEOWNERS', async () => {
    const found = await detectApplications(await fixtureTree(fixture('monorepo')), 'acme/shop');
    expect(found).toEqual([
      {
        path: 'apps/checkout-api',
        key: 'checkout-api',
        name: 'checkout-api',
        description: 'Takes payments',
        signals: ['dockerfile', 'helm', 'pnpm-workspace', 'turborepo'],
        runtime: 'kubernetes',
        owner: { raw: '@acme/payments', source: 'codeowners' },
        system: null,
        sharedBuild: null,
      },
      expect.objectContaining({
        path: 'apps/web',
        key: 'web',
        signals: ['pnpm-workspace', 'turborepo'],
        owner: { raw: '@acme/platform', source: 'codeowners' },
      }),
    ]);
  });
});

describe('discovery across languages', () => {
  it('finds Go, Rust, Gradle, Bazel, serverless, SAM, Nx and Backstage deployables', async () => {
    const found = await detectApplications(await fixtureTree(fixture('polyglot')), 'acme/platform');
    const byPath = Object.fromEntries(found.map((app) => [app.path, app]));
    expect(Object.keys(byPath).sort()).toEqual([
      'apps/admin',
      'billing',
      'crates/indexer',
      'functions/thumbnails',
      'sam',
      'services/orders',
      'tools/proxy',
    ]);
    expect(byPath['services/orders']).toMatchObject({
      key: 'orders',
      description: 'Order intake',
      signals: ['backstage', 'go-module'],
      owner: { raw: 'group:payments', source: 'backstage' },
      system: 'checkout',
    });
    expect(byPath['functions/thumbnails']).toMatchObject({
      key: 'thumbnails',
      runtime: 'function',
      signals: ['serverless'],
    });
    expect(byPath.sam).toMatchObject({ runtime: 'function', signals: ['sam'] });
    expect(byPath.billing).toMatchObject({
      signals: ['gradle'],
      owner: { raw: '@acme/finance', source: 'codeowners' },
    });
    expect(byPath['crates/indexer']).toMatchObject({ key: 'indexer', signals: ['cargo'] });
    expect(byPath['tools/proxy']).toMatchObject({ key: 'proxy', signals: ['bazel'], owner: null });
    expect(byPath['apps/admin']).toMatchObject({ key: 'admin', signals: ['nx'] });
  });
});

describe('the pattern readers', () => {
  it('matches workspace globs one level or any depth', () => {
    expect(compileGlob('apps/*').test('apps/web')).toBe(true);
    expect(compileGlob('apps/*').test('apps/web/src')).toBe(false);
    expect(compileGlob('services/**').test('services/a/b')).toBe(true);
  });

  it('lets the last CODEOWNERS rule win', () => {
    const rules = parseCodeowners('* @all\n/apps/ @apps\napps/web/ @web\n*.md @docs\n');
    expect(ownersOf(rules, '')).toEqual(['@all']);
    expect(ownersOf(rules, 'apps/api')).toEqual(['@apps']);
    expect(ownersOf(rules, 'apps/web')).toEqual(['@web']);
    expect(ownersOf(rules, 'libs/x')).toEqual(['@all']);
  });

  it('reads Cargo, Gradle and go.work without their own parsers', () => {
    expect(cargoMembers('[workspace]\nmembers = [\n  "a",\n  "crates/*",\n]\n')).toEqual([
      'a',
      'crates/*',
    ]);
    expect(cargoMembers('[package]\nname = "x"\n')).toBeNull();
    expect(gradleIncludes("include ':api', 'services:billing'\n")).toEqual([
      'api',
      'services/billing',
    ]);
    expect(goWorkUses('go 1.24\nuse ./api\n')).toEqual(['api']);
  });
});
