import type { CloudAccount, CloudConnection, RunnerPool } from '@bemmoly/module-pipelines/shared';
import { DEFAULT_BUILDER_IMAGE } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { autopilotProblems, createsCluster } from './autopilot-draft.ts';
import {
  buildProjects,
  createPoolBodyOf,
  draftOfPool,
  NEW_POOL,
  poolReady,
  updatePoolBodyOf,
  type PoolDraft,
} from './pool-draft.ts';

/*
 * The pool dialog's GKE Autopilot rules: Pipelines creates the cluster only in a CI project it
 * made, the size must suit Autopilot, an empty builder keeps Kaniko, and editing sends only
 * what changed.
 */

const ID = (n: number) => `0199f0aa-0000-7000-8000-00000000000${n}`;

const projects = buildProjects([
  {
    connection: {
      id: ID(1),
      name: 'Acme',
      provider: 'gcp',
      mode: 'managed',
      region: 'europe-west1',
    } as CloudConnection,
    accounts: [
      {
        id: ID(3),
        externalId: 'acme-ci',
        name: 'acme-ci',
        purpose: 'ci',
        origin: 'created',
        status: 'ready',
      } as CloudAccount,
    ],
  },
  {
    connection: {
      id: ID(2),
      name: 'Nila',
      provider: 'gcp',
      mode: 'attached',
      region: 'asia-south1',
    } as CloudConnection,
    accounts: [
      {
        id: ID(6),
        externalId: 'nila-ci',
        name: 'nila-ci',
        purpose: 'workload',
        origin: 'attached',
        status: 'ready',
      } as CloudAccount,
    ],
  },
]);

const autopilot: PoolDraft = {
  ...NEW_POOL,
  name: 'GKE runners',
  kind: 'gke-autopilot',
  accountId: ID(3),
  image: 'europe-west1-docker.pkg.dev/acme-ci/bemmoly/runner-gke:1.7.0',
  min: '1',
  max: '8',
};

describe('the pool dialog for GKE Autopilot', () => {
  it('makes a pool that creates its cluster in a CI project Pipelines made', () => {
    expect(poolReady(autopilot, projects)).toBe(true);
    expect(createPoolBodyOf(autopilot, projects)).toEqual({
      key: 'gke-runners',
      name: 'GKE runners',
      hosting: 'gke-autopilot',
      minRunners: 1,
      maxRunners: 8,
      autopilot: {
        account: ID(3),
        location: 'europe-west1',
        cluster: { name: 'bemmoly-runners', create: true },
        image: 'europe-west1-docker.pkg.dev/acme-ci/bemmoly/runner-gke:1.7.0',
        cpu: 2,
        memoryGb: 8,
        spot: false,
        serviceAccount: 'builder@acme-ci.iam.gserviceaccount.com',
        builderImage: DEFAULT_BUILDER_IMAGE,
      },
    });
  });

  it('never creates a cluster in an attached project, and marks a size Autopilot refuses', () => {
    const attached = { ...autopilot, accountId: ID(6), createCluster: true };
    expect(createsCluster(attached, projects)).toBe(false);
    expect(autopilotProblems(attached, projects)).toEqual(['serviceAccount']);
    expect(autopilotProblems({ ...autopilot, cpu: '2', memory: '20' }, projects)).toEqual([
      'memoryGb',
    ]);
    expect(
      autopilotProblems({ ...autopilot, cpu: '0.3', memory: '1', cluster: 'Bad_Name' }, projects),
    ).toEqual(['cluster', 'cpu']);
    expect(poolReady({ ...autopilot, memory: '20' }, projects)).toBe(false);
  });

  it('sends only what changed when a pool is edited', () => {
    const created = createPoolBodyOf(autopilot, projects);
    const settings = created.autopilot;
    if (!settings) throw new Error('expected Autopilot settings');
    const pool = {
      key: 'gke-runners',
      name: 'GKE runners',
      hosting: 'gke-autopilot',
      location: null,
      minRunners: 1,
      maxRunners: 8,
      cloudBuild: null,
      autopilot: {
        ...settings,
        account: { id: ID(3), externalId: 'acme-ci', name: 'acme-ci' },
        namespace: 'runners-gke-runners',
        status: 'ready',
        statusDetail: null,
        runners: { running: 0, starting: 0, warm: 1 },
      },
    } as unknown as RunnerPool;
    const draft = draftOfPool(pool);
    expect(draft).toMatchObject({ kind: 'gke-autopilot', builderImage: '', createCluster: true });
    expect(updatePoolBodyOf(pool, draft, projects)).toEqual({});
    expect(updatePoolBodyOf(pool, { ...draft, min: '0', spot: true }, projects)).toEqual({
      minRunners: 0,
      autopilot: expect.objectContaining({
        spot: true,
        cluster: { name: 'bemmoly-runners', create: true },
      }),
    });
  });
});
