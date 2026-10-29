import { describe, expect, it } from 'vitest';
import type { GcpTransport } from '../../../clients/gcp/index.ts';
import {
  createReplayTransport,
  fixedTokens,
  type RecordedExchange,
} from '../../../testing/gcp-replay.ts';
import type { ClusterRecord, ConnectionRecord } from '../contract.ts';
import { createGcpProvider } from './index.ts';

/*
 * Clusters against written answers: creating one through a managed connection and following
 * it, and checking an attached one, each gap one sentence saying what to grant or turn on.
 */

const GKE = 'https://container.googleapis.com/v1';
const KUBE = 'https://10.20.0.2';
const PROJECT = 'nila-shop-prod';
const CA = Buffer.from('recorded-cluster-ca').toString('base64');

const managed: ConnectionRecord = {
  id: '0199f0aa-0000-7000-8000-0000000000b1',
  provider: 'gcp',
  name: 'Acme Google Cloud',
  layout: 'per-environment',
  boundaryRef: 'folders/417302018845',
  config: {
    organizationId: '583920174411',
    billingAccountId: '01A2B3-C4D5E6-F7A8B9',
    credentials: { kind: 'metadata' },
  },
};

const attached: ConnectionRecord = {
  ...managed,
  id: '0199f0aa-0000-7000-8000-0000000000b2',
  name: 'Nila Google Cloud',
  config: { mode: 'attached', region: 'europe-west1', credentials: { kind: 'metadata' } },
};

const shopCluster: ClusterRecord = {
  id: '0199f0aa-0000-7000-8000-0000000000c2',
  origin: 'attached',
  mode: 'autopilot',
  projectId: PROJECT,
  location: 'europe-west1',
  name: 'shop-prod',
  gateway: null,
};

const clusterAnswer = (overrides: Record<string, unknown> = {}): RecordedExchange => ({
  method: 'GET',
  url: `${GKE}/projects/${PROJECT}/locations/europe-west1/clusters/shop-prod`,
  response: {
    name: 'shop-prod',
    status: 'RUNNING',
    endpoint: '10.20.0.2',
    masterAuth: { clusterCaCertificate: CA },
    autopilot: { enabled: true },
    releaseChannel: { channel: 'STABLE' },
    networkConfig: { gatewayApiConfig: { channel: 'CHANNEL_STANDARD' } },
    workloadIdentityConfig: { workloadPool: `${PROJECT}.svc.id.goog` },
    secretManagerConfig: { enabled: true },
    ...overrides,
  },
});

const whoAmI: RecordedExchange = {
  method: 'POST',
  url: 'https://oauth2.googleapis.com/tokeninfo',
  repeat: true,
  response: { email: 'bemmoly@nila-ops.iam.gserviceaccount.com' },
};

const served = (resources: string[]): RecordedExchange => ({
  method: 'GET',
  url: `${KUBE}/apis/gateway.networking.k8s.io/v1`,
  response: { resources: resources.map((name) => ({ name })) },
});

/** Answers every access review: allowed unless its resource is listed as denied. */
function reviews(denied: string[] = []) {
  return (url: string, body: unknown): Response | null => {
    if (!url.endsWith('/selfsubjectaccessreviews')) return null;
    const resource = (body as { spec: { resourceAttributes: { resource: string } } }).spec
      .resourceAttributes.resource;
    return Response.json({ status: { allowed: !denied.includes(resource) } });
  };
}

function recording(exchanges: RecordedExchange[], review = reviews()) {
  const replay = createReplayTransport(exchanges);
  const bodies: Array<{ method: string; url: string; body: unknown }> = [];
  const transport: GcpTransport = (url, init) => {
    const body: unknown = init.body?.startsWith('{') ? JSON.parse(init.body) : init.body;
    bodies.push({ method: init.method, url, body });
    return review(url, body)
      ? Promise.resolve(review(url, body) as Response)
      : replay.transport(url, init);
  };
  const provider = createGcpProvider({
    transport,
    tokensFor: () => fixedTokens(),
    poll: { intervalMs: 0, sleep: async () => {} },
    kubernetesTransport: () => transport,
  });
  if (!provider.clusters) throw new Error('Google Cloud has no clusters part');
  return { clusters: provider.clusters, replay, bodies };
}

describe('creating a cluster through a managed connection', () => {
  const where = { projectId: 'acme-dev', location: 'us-central1', name: 'bemmoly-dev' };

  it('turns GKE on, lets the deployer deploy, and asks for a Standard cluster that runs itself', async () => {
    const { clusters, replay, bodies } = recording([
      {
        method: 'POST',
        url: 'https://serviceusage.googleapis.com/v1/projects/acme-dev/services:batchEnable',
        body: { serviceIds: ['container.googleapis.com'] },
        response: { name: 'operations/acf.enable', done: true },
      },
      {
        method: 'POST',
        url: 'https://cloudresourcemanager.googleapis.com/v3/projects/acme-dev:getIamPolicy',
        response: { etag: 'BwY=', bindings: [] },
      },
      {
        method: 'POST',
        url: 'https://cloudresourcemanager.googleapis.com/v3/projects/acme-dev:setIamPolicy',
        body: {
          policy: {
            bindings: [
              {
                role: 'roles/container.developer',
                members: ['serviceAccount:deployer@acme-dev.iam.gserviceaccount.com'],
              },
            ],
          },
        },
        response: { etag: 'BwZ=' },
      },
      {
        method: 'GET',
        url: `${GKE}/projects/acme-dev/locations/us-central1/clusters/bemmoly-dev`,
        status: 404,
        response: { error: { message: 'Not found', status: 'NOT_FOUND' } },
      },
      {
        method: 'POST',
        url: `${GKE}/projects/acme-dev/locations/us-central1/clusters`,
        response: {
          name: 'projects/acme-dev/locations/us-central1/operations/operation-1730',
          status: 'RUNNING',
          operationType: 'CREATE_CLUSTER',
        },
      },
      {
        method: 'GET',
        url: `${GKE}/projects/acme-dev/locations/us-central1/clusters/bemmoly-dev`,
        response: {
          name: 'bemmoly-dev',
          status: 'PROVISIONING',
          releaseChannel: { channel: 'REGULAR' },
        },
      },
      {
        method: 'GET',
        url: `${GKE}/projects/acme-dev/locations/us-central1/clusters/bemmoly-dev`,
        response: {
          name: 'bemmoly-dev',
          status: 'RUNNING',
          releaseChannel: { channel: 'REGULAR' },
        },
      },
    ]);
    await clusters.create(managed, {
      ...where,
      mode: 'standard',
      labels: { 'managed-by': 'bemmoly', environment: 'dev' },
      account: {},
    });
    const record: ClusterRecord = {
      ...where,
      id: 'c',
      origin: 'created',
      mode: 'standard',
      gateway: null,
    };
    expect((await clusters.read(managed, record)).status).toBe('creating');
    expect(await clusters.read(managed, record)).toMatchObject({
      status: 'ready',
      mode: 'standard',
      releaseChannel: 'REGULAR',
    });
    replay.verify({ allUsed: true });
    const created = bodies.find(
      (entry) => entry.url.endsWith('/clusters') && entry.method === 'POST',
    );
    const cluster = (created?.body as { cluster: Record<string, unknown> }).cluster;
    expect(cluster).toMatchObject({
      name: 'bemmoly-dev',
      releaseChannel: { channel: 'REGULAR' },
      workloadIdentityConfig: { workloadPool: 'acme-dev.svc.id.goog' },
      networkConfig: { gatewayApiConfig: { channel: 'CHANNEL_STANDARD' } },
      maintenancePolicy: { window: { recurringWindow: { recurrence: 'FREQ=WEEKLY;BYDAY=SA,SU' } } },
      secretManagerConfig: { enabled: true },
      nodePools: [{ autoscaling: { enabled: true, minNodeCount: 1, maxNodeCount: 3 } }],
    });
    expect(cluster['autopilot']).toBeUndefined();
  });

  it('refuses to create one through an attached connection', async () => {
    const { clusters } = recording([]);
    await expect(
      clusters.create(attached, { ...where, mode: 'autopilot', labels: {}, account: null }),
    ).rejects.toThrow(/attach a cluster there instead/);
  });
});

describe('checking an attached cluster', () => {
  it('passes when the Gateway API is on and the deploy rights are held', async () => {
    const { clusters, replay, bodies } = recording([
      whoAmI,
      clusterAnswer(),
      served(['gateways', 'httproutes']),
    ]);
    const check = await clusters.verify(attached, shopCluster, null);
    expect(check).toEqual({ ok: true, mode: 'autopilot', releaseChannel: 'STABLE', problems: [] });
    replay.verify({ allUsed: true });
    expect(bodies.some((entry) => entry.method !== 'GET' && entry.method !== 'POST')).toBe(false);
  });

  it('says what to turn on and grant, one sentence each', async () => {
    const { clusters } = recording(
      [
        whoAmI,
        clusterAnswer({ networkConfig: {} }),
        {
          method: 'GET',
          url: `${KUBE}/apis/gateway.networking.k8s.io/v1`,
          status: 404,
          response: {},
        },
      ],
      reviews(['httproutes', 'gateways', 'namespaces']),
    );
    const check = await clusters.verify(attached, shopCluster, null);
    expect(check.ok).toBe(false);
    expect(check.problems).toEqual([
      'Turn on the Gateway API on shop-prod: gcloud container clusters update shop-prod --location europe-west1 --gateway-api=standard',
      "Grant bemmoly@nila-ops.iam.gserviceaccount.com rights to create and update httproutes in shop-prod: Kubernetes Engine Developer on nila-shop-prod, or a RoleBinding in each group's namespace",
      'Grant bemmoly@nila-ops.iam.gserviceaccount.com rights to create Gateways in shop-prod, or attach it again naming the Gateway routes should use',
      'bemmoly@nila-ops.iam.gserviceaccount.com cannot create namespaces in shop-prod. Create one per catalog group yourself, or grant it that right',
    ]);
  });

  it('says the cluster cannot be seen, or found, before anything else', async () => {
    const hidden = recording([
      whoAmI,
      {
        ...clusterAnswer(),
        status: 403,
        response: { error: { message: 'denied', status: 'PERMISSION_DENIED' } },
      },
    ]);
    expect((await hidden.clusters.verify(attached, shopCluster, null)).problems).toEqual([
      'bemmoly@nila-ops.iam.gserviceaccount.com cannot see cluster shop-prod. Grant it Kubernetes Engine Cluster Viewer on nila-shop-prod',
    ]);
    const missing = recording([
      whoAmI,
      { ...clusterAnswer(), status: 404, response: { error: { message: 'Not found' } } },
    ]);
    expect((await missing.clusters.verify(attached, shopCluster, null)).problems).toEqual([
      'Cluster shop-prod was not found in nila-shop-prod, europe-west1. Check the project, location and name',
    ]);
  });

  it('warns, without failing, when pods could not read secrets there', async () => {
    const { clusters } = recording(
      [whoAmI, clusterAnswer({ secretManagerConfig: {} }), served(['gateways', 'httproutes'])],
      reviews(['secretproviderclasses']),
    );
    const check = await clusters.verify(attached, shopCluster, null);
    expect(check.ok).toBe(true);
    expect(check.problems).toEqual([
      'Turn on the Secret Manager add-on on shop-prod so applications there can read their secrets: gcloud container clusters update shop-prod --location europe-west1 --enable-secret-manager',
      'Grant bemmoly@nila-ops.iam.gserviceaccount.com rights to create secretproviderclasses in shop-prod so applications there can read their secrets',
    ]);
  });

  it('needs no Gateway rights when the owners name their own Gateway', async () => {
    const { clusters } = recording(
      [whoAmI, clusterAnswer(), served(['gateways', 'httproutes'])],
      reviews(['gateways']),
    );
    const owned = { ...shopCluster, gateway: { namespace: 'infra', name: 'shared' } };
    expect((await clusters.verify(attached, owned, null)).ok).toBe(true);
  });
});
