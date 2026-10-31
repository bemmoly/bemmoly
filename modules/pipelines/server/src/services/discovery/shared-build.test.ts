import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { repositoryFileSchema } from '../../../../shared/repository-yaml.ts';
import { detectApplications } from './detect.ts';
import { fixtureTree } from './fixture-tree.ts';
import { writeRepositoryProposal, type ProposedEntry } from './repository-proposal.ts';

/*
 * Folders that share one Dockerfile, picked by an ARG or by a compose file's args, are
 * proposed with their shared build, and the repository file proposed for them keeps the
 * Dockerfile and args in `defaults` with a short entry per application.
 */

const fixture = (name: string) => fileURLToPath(new URL(`./testdata/${name}`, import.meta.url));

describe('a shared Dockerfile', () => {
  it('proposes each folder it builds, with SERVICE as the application’s name', async () => {
    const found = await detectApplications(
      await fixtureTree(fixture('shared-dockerfile')),
      'acme/shop',
    );
    expect(found.map((app) => [app.path, app.signals, app.sharedBuild])).toEqual([
      ['apps/storefront', ['dockerfile', 'npm-workspace'], null],
      ...['invoices', 'orders', 'shipping'].map((name) => [
        `services/${name}`,
        ['shared-dockerfile'],
        {
          dockerfile: 'docker/service.Dockerfile',
          context: '.',
          args: { SERVICE: '${{ app.name }}' },
        },
      ]),
    ]);
  });

  it('reads a compose file whose services build one Dockerfile', async () => {
    const found = await detectApplications(
      await fixtureTree(fixture('compose-lanes')),
      'acme/lanes',
    );
    expect(found.map((app) => [app.path, app.key, app.sharedBuild])).toEqual([
      [
        'apps/api',
        'api',
        { dockerfile: 'docker/app.Dockerfile', context: '.', args: { APP: '${{ app.name }}' } },
      ],
      [
        'apps/worker',
        'worker',
        { dockerfile: 'docker/app.Dockerfile', context: '.', args: { APP: '${{ app.name }}' } },
      ],
    ]);
  });
});

describe('the proposed repository file', () => {
  const build = { dockerfile: 'docker/service.Dockerfile', context: '.' };
  const entry = (key: string, extra: Partial<ProposedEntry> = {}): ProposedEntry => ({
    key,
    path: `services/${key}`,
    group: 'commerce/checkout',
    owner: 'team/payments',
    build: { ...build, args: { SERVICE: '${{ app.name }}' } },
    ...extra,
  });

  it('puts what entries share in defaults and keeps each entry short', () => {
    const text = writeRepositoryProposal([
      entry('orders'),
      entry('invoices', { tier: 1, build: { ...build, args: { SERVICE: 'billing' } } }),
      entry('shipping', { owner: 'team/logistics' }),
    ]);
    expect(text)
      .toBe(`# Settings for every application in this repository, proposed by Bemmoly Pipelines.
# A folder's own .bemmoly/application.yaml beats its entry here, which beats defaults.

defaults:
  group: checkout
  domain: commerce
  build:
    dockerfile: docker/service.Dockerfile
applications:
  - name: invoices
    path: services/invoices
    owner: team/payments
    tier: 1
    build:
      args:
        SERVICE: billing
  - name: orders
    path: services/orders
    owner: team/payments
    build:
      args:
        SERVICE: \${{ app.name }}
  - name: shipping
    path: services/shipping
    owner: team/logistics
    build:
      args:
        SERVICE: \${{ app.name }}
`);
    expect(repositoryFileSchema.safeParse(parse(text)).success).toBe(true);
  });

  it('keeps shared args in defaults', () => {
    const file = parse(writeRepositoryProposal([entry('orders'), entry('invoices')]));
    expect(file.defaults).toEqual({
      group: 'checkout',
      domain: 'commerce',
      owner: 'team/payments',
      build: { dockerfile: 'docker/service.Dockerfile', args: { SERVICE: '${{ app.name }}' } },
    });
    expect(file.applications).toEqual([
      { name: 'invoices', path: 'services/invoices' },
      { name: 'orders', path: 'services/orders' },
    ]);
  });
});
