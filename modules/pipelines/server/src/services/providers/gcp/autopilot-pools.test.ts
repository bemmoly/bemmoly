import { describe, expect, it } from 'vitest';
import {
  attached,
  CLUSTER_URL,
  clusterAnswer,
  KUBE,
  managed,
  NAMESPACE,
  POOL_REF,
  recordingRunners,
  site,
} from '../../../testing/autopilot-fixture.ts';
import { loadFixture } from '../../../testing/gcp-replay.ts';

/*
 * Preparing a GKE Autopilot runner pool against recorded answers: a missing cluster is created
 * in the CI project on a managed connection and followed until it runs; a running one gets
 * the pool's namespace, its pods' service account, the Workload Identity binding and its warm
 * room; and every way it cannot be prepared says in one sentence what to do.
 */

const GKE_PARENT = 'https://container.googleapis.com/v1/projects/nila-ci/locations/europe-west1';

describe('preparing a GKE Autopilot runner pool', () => {
  it('creates a missing Autopilot cluster in the CI project, then waits while GKE makes it', async () => {
    const { runners, replay, bodies } = recordingRunners([
      { method: 'GET', url: CLUSTER_URL, status: 404, response: { error: { code: 404 } } },
      {
        method: 'POST',
        url: 'https://serviceusage.googleapis.com/v1/projects/nila-ci/services:batchEnable',
        body: { serviceIds: ['container.googleapis.com'] },
        response: { name: 'operations/acf.enable', done: true },
      },
      {
        method: 'POST',
        url: `${GKE_PARENT}/clusters`,
        body: { cluster: { name: 'bemmoly-runners', autopilot: { enabled: true } } },
        response: { name: 'operation-1730193123', status: 'RUNNING' },
      },
      clusterAnswer({ status: 'PROVISIONING' }),
    ]);
    expect(await runners.ensurePool(managed, site())).toEqual({
      ref: POOL_REF,
      status: 'preparing',
      detail: 'Creating Autopilot cluster bemmoly-runners in nila-ci',
      warm: 0,
    });
    const created = bodies.find((call) => call.url.endsWith('/clusters'))?.body as {
      cluster: { resourceLabels: Record<string, string>; workloadIdentityConfig: unknown };
    };
    expect(created.cluster.resourceLabels).toEqual({
      'bemmoly-purpose': 'runners',
      'bemmoly-pool': 'gke',
    });
    expect(created.cluster.workloadIdentityConfig).toEqual({ workloadPool: 'nila-ci.svc.id.goog' });
    expect(await runners.ensurePool(managed, site())).toMatchObject({
      status: 'preparing',
      detail: 'GKE is creating cluster bemmoly-runners',
    });
    replay.verify({ allUsed: true });
  });

  it('sets up the namespace, the identity and the warm room on a running cluster, then counts it', async () => {
    const { runners, replay, bodies } = recordingRunners(loadFixture('gke-runner-pools'));
    expect(await runners.ensurePool(managed, site())).toEqual({
      ref: POOL_REF,
      status: 'ready',
      detail: null,
      warm: 1,
    });
    const room = bodies.find((call) => call.url.includes('/deployments/'))?.body as {
      spec: { template: { spec: Record<string, unknown> } };
    };
    expect(room.spec.template.spec).toMatchObject({
      automountServiceAccountToken: false,
      terminationGracePeriodSeconds: 0,
    });
    expect(
      await runners.readPool(managed, {
        account: site().account,
        region: 'europe-west1',
        ref: POOL_REF,
      }),
    ).toEqual({ warm: 2 });
    expect(replay.calls.slice(0, 8)).toEqual([
      'GET /v1/projects/nila-ci/locations/europe-west1/clusters/bemmoly-runners',
      `PATCH /api/v1/namespaces/${NAMESPACE}`,
      `PATCH /api/v1/namespaces/${NAMESPACE}/serviceaccounts/bemmoly-runner`,
      'POST /v1/projects/-/serviceAccounts/builder@nila-ci.iam.gserviceaccount.com:getIamPolicy',
      'POST /v1/projects/-/serviceAccounts/builder@nila-ci.iam.gserviceaccount.com:setIamPolicy',
      'PATCH /apis/scheduling.k8s.io/v1/priorityclasses/bemmoly-warm-room',
      `PATCH /apis/apps/v1/namespaces/${NAMESPACE}/deployments/bemmoly-warm-room`,
      `GET /apis/apps/v1/namespaces/${NAMESPACE}/deployments/bemmoly-warm-room`,
    ]);
  });

  it('keeps no warm room when the pool has no fewest, and binds nothing twice', async () => {
    const { runners, replay } = recordingRunners([
      clusterAnswer(),
      {
        method: 'PATCH',
        url: `${KUBE}/api/v1/namespaces/${NAMESPACE}`,
        response: { metadata: { name: NAMESPACE } },
      },
      {
        method: 'PATCH',
        url: `${KUBE}/api/v1/namespaces/${NAMESPACE}/serviceaccounts/bemmoly-runner`,
        response: { metadata: { name: 'bemmoly-runner' } },
      },
      {
        method: 'POST',
        url: 'https://iam.googleapis.com/v1/projects/-/serviceAccounts/builder@nila-ci.iam.gserviceaccount.com:getIamPolicy',
        response: {
          bindings: [
            {
              role: 'roles/iam.workloadIdentityUser',
              members: [`serviceAccount:nila-ci.svc.id.goog[${NAMESPACE}/bemmoly-runner]`],
            },
          ],
        },
      },
      {
        method: 'DELETE',
        url: `${KUBE}/apis/apps/v1/namespaces/${NAMESPACE}/deployments/bemmoly-warm-room`,
        status: 404,
        response: { kind: 'Status', reason: 'NotFound' },
      },
    ]);
    expect(await runners.ensurePool(managed, site({ warm: 0 }))).toMatchObject({
      status: 'ready',
      warm: 0,
    });
    replay.verify({ allUsed: true });
  });

  it('says what to do when the cluster is missing, Standard, or the identity cannot be bound', async () => {
    const missing = recordingRunners([
      { method: 'GET', url: CLUSTER_URL, status: 404, response: { error: { code: 404 } } },
    ]);
    expect(await missing.runners.ensurePool(attached, site())).toMatchObject({
      status: 'failed',
      detail:
        'Cluster bemmoly-runners was not found in nila-ci, europe-west1. Create it, or check the project, location and name',
    });
    const standard = recordingRunners([clusterAnswer({ autopilot: {} })]);
    expect((await standard.runners.ensurePool(attached, site())).detail).toMatch(
      /^bemmoly-runners is a Standard cluster\. Pick an Autopilot cluster/,
    );
    const locked = recordingRunners([
      clusterAnswer(),
      {
        method: 'PATCH',
        url: `${KUBE}/api/v1/namespaces/${NAMESPACE}`,
        response: { metadata: { name: NAMESPACE } },
      },
      {
        method: 'PATCH',
        url: `${KUBE}/api/v1/namespaces/${NAMESPACE}/serviceaccounts/bemmoly-runner`,
        response: { metadata: { name: 'bemmoly-runner' } },
      },
      {
        method: 'POST',
        url: 'https://iam.googleapis.com/v1/projects/-/serviceAccounts/builder@nila-ci.iam.gserviceaccount.com:getIamPolicy',
        status: 403,
        response: {
          error: {
            code: 403,
            message: 'Permission iam.serviceAccounts.getIamPolicy denied',
            status: 'PERMISSION_DENIED',
          },
        },
      },
    ]);
    expect((await locked.runners.ensurePool(attached, site())).detail).toBe(
      `Pipelines may not let the pool's pods act as builder@nila-ci.iam.gserviceaccount.com. Run: gcloud iam service-accounts add-iam-policy-binding builder@nila-ci.iam.gserviceaccount.com --role roles/iam.workloadIdentityUser --member "serviceAccount:nila-ci.svc.id.goog[${NAMESPACE}/bemmoly-runner]"`,
    );
    const refused = recordingRunners([
      clusterAnswer(),
      {
        method: 'PATCH',
        url: `${KUBE}/api/v1/namespaces/${NAMESPACE}`,
        status: 403,
        response: { kind: 'Status', reason: 'Forbidden', message: 'namespaces is forbidden' },
      },
    ]);
    expect((await refused.runners.ensurePool(attached, site())).detail).toBe(
      'Cluster bemmoly-runners refused Pipelines: namespaces is forbidden. Grant it Kubernetes Engine Admin on nila-ci',
    );
  });
});
