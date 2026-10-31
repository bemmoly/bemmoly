import type { GcpTransport } from '../clients/gcp/index.ts';
import { createGcpProvider } from '../services/providers/gcp/index.ts';
import type { ConnectionRecord, RunnersPart } from '../services/providers/contract.ts';
import type { MachineLaunch, PodPoolSite } from '../services/providers/runners-contract.ts';
import { createReplayTransport, fixedTokens, type RecordedExchange } from './gcp-replay.ts';

/*
 * What the GKE Autopilot runner tests share: a managed and an attached connection, the CI
 * project's pool as Pipelines wants it, one job's pod launch, and the Google Cloud provider
 * replaying recorded answers for both Google's APIs and the cluster's own.
 */

export const GKE = 'https://container.googleapis.com/v1';
export const KUBE = 'https://10.30.0.2';
export const CLUSTER_URL = `${GKE}/projects/nila-ci/locations/europe-west1/clusters/bemmoly-runners`;
export const NAMESPACE = 'runners-gke';
export const LAUNCH_TOKEN = 'bpl_recorded-launch-token-for-tests';
export const JOB_ID = '0199f0bb-1111-7000-8000-000000000001';
export const JOB_NAME = `bemmoly-${JOB_ID}-c85626`;
export const POOL_REF = `projects/nila-ci/locations/europe-west1/clusters/bemmoly-runners/namespaces/${NAMESPACE}`;
export const POD_REF = `${POOL_REF}/jobs/${JOB_NAME}`;
export const RUNNER_IMAGE = 'europe-west1-docker.pkg.dev/nila-ci/bemmoly/runner-gke:1.7.0';

export const managed: ConnectionRecord = {
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

export const attached: ConnectionRecord = {
  ...managed,
  id: '0199f0aa-0000-7000-8000-0000000000b2',
  name: 'Nila Google Cloud',
  config: { mode: 'attached', region: 'europe-west1', credentials: { kind: 'metadata' } },
};

export const account = { externalId: 'nila-ci', config: {} };

export const site = (overrides: Partial<PodPoolSite> = {}): PodPoolSite => ({
  account,
  pool: 'gke',
  cluster: { location: 'europe-west1', name: 'bemmoly-runners', create: true },
  namespace: NAMESPACE,
  serviceAccount: 'builder@nila-ci.iam.gserviceaccount.com',
  size: { cpu: 2, memoryGb: 8, spot: false },
  warm: 2,
  ...overrides,
});

export const podLaunch = (overrides: Partial<MachineLaunch> = {}): MachineLaunch => ({
  account,
  region: 'europe-west1',
  image: RUNNER_IMAGE,
  machineType: null,
  serviceAccount: 'builder@nila-ci.iam.gserviceaccount.com',
  controlPlaneUrl: 'https://bemmoly.nila.example',
  launchToken: LAUNCH_TOKEN,
  timeoutMinutes: 75,
  labels: { pool: 'gke', job: JOB_ID, run: '0199f0bb-2222-7000-8000-000000000002' },
  pod: {
    cluster: { location: 'europe-west1', name: 'bemmoly-runners' },
    namespace: NAMESPACE,
    size: { cpu: 2, memoryGb: 8, spot: true },
    stepImages: ['node:24', 'alpine:3.20'],
    builderImage: 'gcr.io/kaniko-project/executor:v1.23.2-debug',
  },
  ...overrides,
});

/** A running Autopilot cluster as GKE describes it, with any fields changed. */
export const clusterAnswer = (overrides: Record<string, unknown> = {}): RecordedExchange => ({
  method: 'GET',
  url: CLUSTER_URL,
  response: {
    name: 'bemmoly-runners',
    status: 'RUNNING',
    endpoint: '10.30.0.2',
    masterAuth: {
      clusterCaCertificate: Buffer.from('recorded-runner-cluster-ca').toString('base64'),
    },
    autopilot: { enabled: true },
    workloadIdentityConfig: { workloadPool: 'nila-ci.svc.id.goog' },
    ...overrides,
  },
});

export function recordingRunners(...exchanges: RecordedExchange[][]) {
  const replay = createReplayTransport(...exchanges);
  const bodies: Array<{ method: string; url: string; body: unknown }> = [];
  const transport: GcpTransport = (url, init) => {
    bodies.push({ method: init.method, url, body: init.body ? JSON.parse(init.body) : undefined });
    return replay.transport(url, init);
  };
  const runners = createGcpProvider({
    transport,
    tokensFor: () => fixedTokens(),
    poll: { intervalMs: 0, sleep: async () => {} },
    kubernetesTransport: () => transport,
  }).runners as Required<RunnersPart>;
  return { runners, replay, bodies };
}
