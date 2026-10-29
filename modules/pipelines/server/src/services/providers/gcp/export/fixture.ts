import type { ExportFacts, ExportRecords } from '../../export-contract.ts';

/*
 * One managed connection on the Standard layout, as the reconciler and the shipping engine
 * recorded it: the bootstrap's control project, a CI project and a Prod project, the shared
 * registry, checkout-api on Cloud Run (public, with a secret) and payments-worker on GKE
 * Autopilot in Pipelines' own cluster, and a Cloud Build pool. The golden files under
 * testdata/ are what it exports.
 */

const CONTROL = 'bemmoly-control-583920174411';
const CI = 'acme-ci-7f3a';
const PROD = 'acme-prod-7f3a';
const DIGEST = 'sha256:4f1c2a9e0b7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e';
const REGISTRY = `us-central1-docker.pkg.dev/${CONTROL}/apps`;

const resource = (kind: string, name: string, account: string, spec: Record<string, unknown>) =>
  ({ kind, name, account, spec }) as ExportRecords['resources'][number];

const releaseOf = (application: string, version: string, deploy: Record<string, unknown>) => ({
  id: `release-${application}`,
  version,
  commitSha: 'a1c9e3f0b2',
  imageRepository: `${REGISTRY}/${application}`,
  imageDigests: { 'linux/amd64': DIGEST },
  resolvedConfig: { deploy },
});

export const EXPORT_RECORDS: ExportRecords = {
  connection: {
    id: 'connection-1',
    provider: 'gcp',
    name: 'Acme Google Cloud',
    layout: 'per-environment',
    boundaryRef: 'folders/417302018845',
    config: {
      mode: 'managed',
      region: 'us-central1',
      folderId: '417302018845',
      billingAccountId: '01A2B3-C4D5E6-F7A8B9',
      controlProject: CONTROL,
    },
    principal: `bemmoly-control@${CONTROL}.iam.gserviceaccount.com`,
  },
  accounts: [
    {
      externalId: CONTROL,
      name: 'Bemmoly platform',
      origin: 'created',
      purpose: 'control',
      config: {},
    },
    { externalId: CI, name: 'Bemmoly CI', origin: 'created', purpose: 'ci', config: {} },
    { externalId: PROD, name: 'Prod', origin: 'created', purpose: 'workload', config: {} },
  ],
  resources: [
    resource('account', 'project', CONTROL, {
      displayName: 'Bemmoly platform',
      folder: null,
      labels: {},
      adopt: true,
    }),
    resource('account', 'project', CI, {
      displayName: 'Bemmoly CI',
      folder: null,
      labels: { purpose: 'ci' },
      adopt: false,
    }),
    resource('account', 'project', PROD, {
      displayName: 'Prod',
      folder: 'Commerce',
      labels: { environment: 'prod' },
      adopt: false,
    }),
    resource('service_api', 'services', CI, { features: ['builds', 'logging'] }),
    resource('service_api', 'services', PROD, { features: ['containers', 'secrets'] }),
    resource('network', 'default', PROD, { name: 'bemmoly', subnets: 'auto' }),
    resource('logging', 'logs', PROD, { retentionDays: 30 }),
    resource('budget', 'budget', PROD, { monthly: 500, currency: 'USD', alerts: [1, 0.5, 0.9] }),
    resource('runtime_identity', 'builder', CONTROL, { name: 'builder', purpose: 'build' }),
    resource('deployer_identity', 'deployer', PROD, { name: 'deployer' }),
    resource('runtime_identity', 'runtime', PROD, { name: 'runtime', purpose: 'runtime' }),
    resource('registry_access', 'apps', CONTROL, {
      registryAccount: CONTROL,
      repository: 'apps',
      region: 'us-central1',
      access: 'push',
      identity: 'builder',
    }),
    resource('registry_access', 'apps', PROD, {
      registryAccount: CONTROL,
      repository: 'apps',
      region: 'us-central1',
      access: 'pull',
      identity: 'runtime',
    }),
    resource('secret_store', 'secrets', PROD, { readers: ['runtime'] }),
  ],
  services: [
    {
      application: 'checkout-api',
      environment: { key: 'prod', region: null },
      account: { externalId: PROD, config: {} },
      placement: { runtime: 'cloud-run', cluster: null, namespace: 'checkout' },
      release: releaseOf('checkout-api', 'v1.43.0', {
        port: 8080,
        resources: { cpu: 1, memory: '512Mi' },
        healthcheck: { path: '/healthz', timeoutSeconds: 5 },
        public: true,
      }),
      revision: 'checkout-api-v1-43-0-a1c9e3f',
      variables: [
        {
          name: 'DB_URL',
          kind: 'secret',
          account: PROD,
          secret: 'bemmoly-checkout-api-DB_URL-prod',
          version: '3',
        },
        { name: 'LOG_LEVEL', kind: 'plain', value: 'info' },
      ],
      moving: false,
    },
    {
      application: 'payments-worker',
      environment: { key: 'prod', region: null },
      account: { externalId: PROD, config: {} },
      placement: {
        runtime: 'gke-autopilot',
        namespace: 'checkout',
        cluster: {
          id: 'cluster-1',
          origin: 'created',
          mode: 'autopilot',
          projectId: PROD,
          location: 'us-central1',
          name: 'bemmoly-prod',
          gateway: null,
        },
      },
      release: releaseOf('payments-worker', 'v2.1.0', {
        port: '9090',
        resources: { cpu: '500m', memory: '1Gi' },
        healthcheck: { path: '/ready', timeoutSeconds: 3 },
      }),
      revision: 'payments-worker-v2-1-0-a1c9e3f',
      variables: [
        { name: 'QUEUE', kind: 'plain', value: 'payments' },
        {
          name: 'STRIPE_KEY',
          kind: 'secret',
          account: PROD,
          secret: 'bemmoly-payments-worker-STRIPE_KEY-prod',
          version: '1',
        },
      ],
      moving: true,
    },
  ],
  clusters: [
    {
      id: 'cluster-1',
      origin: 'created',
      mode: 'autopilot',
      projectId: PROD,
      location: 'us-central1',
      name: 'bemmoly-prod',
      gateway: null,
      environment: 'prod',
    },
  ],
  secrets: [
    { account: PROD, name: 'bemmoly-checkout-api-DB_URL-prod' },
    { account: PROD, name: 'bemmoly-payments-worker-STRIPE_KEY-prod' },
  ],
  pools: [
    {
      key: 'cloud-build',
      kind: 'cloud-build',
      account: CI,
      region: 'us-central1',
      image: 'us-docker.pkg.dev/acme-ci-7f3a/bemmoly/runner:1',
      machine: 'e2-highcpu-8',
      serviceAccount: `builder@${CI}.iam.gserviceaccount.com`,
    },
    {
      key: 'gke-runners',
      kind: 'gke-autopilot',
      account: CI,
      location: 'us-central1',
      cluster: { name: 'bemmoly-runners', create: true },
      namespace: 'bemmoly-runners-gke-runners',
      image: 'us-docker.pkg.dev/acme-ci-7f3a/bemmoly/runner-gke:1',
      builderImage: 'gcr.io/kaniko-project/executor:v1.23.2-debug',
      cpu: 2,
      memoryGb: 8,
      spot: true,
      serviceAccount: `builder@${CI}.iam.gserviceaccount.com`,
    },
  ],
  frontDoors: [
    {
      environment: 'prod',
      account: PROD,
      region: null,
      domain: 'prod.acme.example',
      hosts: [
        {
          application: 'checkout-api',
          namespace: 'checkout',
          host: 'checkout-api.prod.acme.example',
          // Moving from Cloud Run to GKE: the export keeps Cloud Run, which takes most.
          backends: [
            { runtime: 'cloud-run', revision: null, percent: 70 },
            { runtime: 'gke-autopilot', revision: 'checkout-api-v1-43-0-a1c9e3f', percent: 30 },
          ],
          moving: true,
        },
        {
          application: 'payments-worker',
          namespace: 'checkout',
          host: 'payments-worker.prod.acme.example',
          backends: [
            { runtime: 'gke-autopilot', revision: 'payments-worker-v2-1-0-a1c9e3f', percent: 100 },
          ],
          moving: false,
        },
      ],
    },
  ],
  leftOut: [
    'gift-cards in staging: staging has no Google Cloud project yet; apply the landing zone first.',
  ],
};

export const EXPORT_FACTS: ExportFacts = {
  accounts: {
    [CONTROL]: { number: '583920174411', parent: 'folders/417302018845' },
    [CI]: { number: '771205334188', parent: 'folders/417302018845' },
    [PROD]: { number: '481920334412', parent: 'folders/902114773051' },
  },
  budgets: {
    [PROD]: 'billingAccounts/01A2B3-C4D5E6-F7A8B9/budgets/6f1e2d3c-4b5a-4f6e-8d7c-9b0a1f2e3d4c',
  },
  groups: {
    'fd-checkout-payments-worker-v2-1-0-a1c9e3f-80': [
      `https://www.googleapis.com/compute/v1/projects/${PROD}/zones/us-central1-a/networkEndpointGroups/fd-checkout-payments-worker-v2-1-0-a1c9e3f-80`,
      `https://www.googleapis.com/compute/v1/projects/${PROD}/zones/us-central1-b/networkEndpointGroups/fd-checkout-payments-worker-v2-1-0-a1c9e3f-80`,
    ],
  },
  problems: [],
};
