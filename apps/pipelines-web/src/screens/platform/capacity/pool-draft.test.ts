import type { CloudAccount, CloudConnection, RunnerPool } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import {
  buildProjects,
  cloudBuildProblems,
  createPoolBodyOf,
  draftOfPool,
  NEW_POOL,
  poolReady,
  updatePoolBodyOf,
  type PoolDraft,
} from './pool-draft.ts';

const ID = (n: number) => `0199f0aa-0000-7000-8000-00000000000${n}`;

const connection = (mode: 'managed' | 'attached', name: string) =>
  ({
    id: ID(mode === 'managed' ? 1 : 2),
    name,
    provider: 'gcp',
    mode,
    region: 'europe-west1',
  }) as CloudConnection;

const account = (
  id: number,
  externalId: string,
  purpose: CloudAccount['purpose'],
  origin: CloudAccount['origin'],
  status: CloudAccount['status'] = 'ready',
) => ({ id: ID(id), externalId, name: externalId, purpose, origin, status }) as CloudAccount;

const projects = buildProjects([
  {
    connection: connection('managed', 'Acme'),
    accounts: [
      account(3, 'acme-ci', 'ci', 'created'),
      account(4, 'acme-dev', 'workload', 'created'),
      account(5, 'acme-ci-old', 'ci', 'created', 'failed'),
    ],
  },
  {
    connection: connection('attached', 'Nila'),
    accounts: [account(6, 'nila-ci', 'workload', 'attached')],
  },
]);

const cloudBuild: PoolDraft = {
  ...NEW_POOL,
  name: 'Cloud builds',
  kind: 'cloud-build',
  accountId: ID(3),
  image: 'europe-west1-docker.pkg.dev/acme-ci/bemmoly/runner:1.7.0',
  max: '6',
};

describe('the pool dialog', () => {
  it('offers ready CI projects and attached ones, suggesting the builder Pipelines made', () => {
    expect(projects.map((project) => [project.externalId, project.builder])).toEqual([
      ['acme-ci', 'builder@acme-ci.iam.gserviceaccount.com'],
      ['nila-ci', null],
    ]);
  });

  it('makes a Cloud Build pool with its region and service account from the project', () => {
    expect(poolReady(cloudBuild, projects)).toBe(true);
    expect(createPoolBodyOf(cloudBuild, projects)).toEqual({
      key: 'cloud-builds',
      name: 'Cloud builds',
      hosting: 'cloud-build',
      minRunners: 0,
      maxRunners: 6,
      cloudBuild: {
        account: ID(3),
        region: 'europe-west1',
        image: 'europe-west1-docker.pkg.dev/acme-ci/bemmoly/runner:1.7.0',
        machine: 'default',
        serviceAccount: 'builder@acme-ci.iam.gserviceaccount.com',
      },
    });
  });

  it('marks what an attached project still needs before it is ready', () => {
    const attached = { ...cloudBuild, accountId: ID(6), image: 'not an image' };
    expect(cloudBuildProblems(attached, projects)).toEqual(['image', 'serviceAccount']);
    expect(poolReady(attached, projects)).toBe(false);
    expect(cloudBuildProblems({ ...cloudBuild, accountId: null }, projects)).toEqual([
      'account',
      'region',
      'serviceAccount',
    ]);
  });

  it('sends only what changed, and a switch to Cloud Build carries its settings', () => {
    const pool = {
      key: 'laptops',
      name: 'Laptops',
      hosting: 'vm',
      location: null,
      minRunners: 0,
      maxRunners: 6,
      cloudBuild: null,
    } as unknown as RunnerPool;
    expect(updatePoolBodyOf(pool, draftOfPool(pool), projects)).toEqual({});
    expect(
      updatePoolBodyOf(pool, { ...draftOfPool(pool), ...cloudBuild, name: 'Laptops' }, projects),
    ).toEqual({
      hosting: 'cloud-build',
      cloudBuild: expect.objectContaining({ account: ID(3), region: 'europe-west1' }),
    });
  });
});
