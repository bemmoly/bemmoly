import { describe, expect, it } from 'vitest';
import type { GcpTransport } from '../../../clients/gcp/index.ts';
import {
  createReplayTransport,
  fixedTokens,
  GCP_PROD_TARGET,
  type RecordedExchange,
} from '../../../testing/gcp-replay.ts';
import type { DeployTarget, DeployVariable, ReleaseArtifact } from '../contract.ts';
import { containerEnv, secretClassManifest } from './gke-secrets.ts';
import { createGcpProvider } from './index.ts';

/*
 * Secrets on GKE against written answers: a deploy grants the pods' Workload Identity
 * principal access to the secret and names its version in a SecretProviderClass. By default a
 * SecretSync copies it into a Kubernetes Secret the container reads with secretKeyRef; with
 * secretsAs files, GKE's Secret Manager add-on mounts it instead. No value is sent anywhere,
 * and a cluster without the add-on or its sync is refused with what to turn on.
 */

const KUBE = 'https://34.118.10.2';
const NS = `${KUBE}/apis/gateway.networking.k8s.io/v1/namespaces/checkout`;
const APPLY = '?fieldManager=bemmoly-pipelines&force=true';
const SM = 'https://secretmanager.googleapis.com/v1/projects/acme-commerce-prod/secrets';
const REVISION = 'checkout-api-v2-0-0-c4e8a10';
const SECRET = 'bemmoly-checkout-api-API_KEY-prod';
const PRINCIPAL =
  'principal://iam.googleapis.com/projects/481920334412/locations/global/workloadIdentityPools/acme-commerce-prod.svc.id.goog/subject/ns/checkout/sa/checkout-api';

const release = (secretsAs?: 'env' | 'files'): ReleaseArtifact => ({
  id: '00000000-0000-7000-8000-000000000002',
  version: 'v2.0.0',
  commitSha: 'c4e8a10',
  imageRepository: 'asia-south1-docker.pkg.dev/acme-ci/apps/checkout-api',
  imageDigests: { 'linux/amd64': `sha256:${'2'.repeat(64)}` },
  resolvedConfig: secretsAs ? { deploy: { secretsAs } } : {},
});

const variables: DeployVariable[] = [
  { name: 'GREETING', kind: 'plain', value: 'hello' },
  { name: 'API_KEY', kind: 'secret', account: 'acme-commerce-prod', secret: SECRET, version: '3' },
];

const target: DeployTarget = {
  ...GCP_PROD_TARGET,
  placement: {
    runtime: 'gke-autopilot',
    namespace: 'checkout',
    cluster: {
      id: '0199f0aa-0000-7000-8000-0000000000c1',
      origin: 'created',
      mode: 'autopilot',
      projectId: 'acme-commerce-prod',
      location: 'asia-south1',
      name: 'bemmoly-prod-asia-south1',
      gateway: null,
    },
  },
};

const cluster = (secretManager: boolean, sync = true): RecordedExchange => ({
  method: 'GET',
  url: 'https://container.googleapis.com/v1/projects/acme-commerce-prod/locations/asia-south1/clusters/bemmoly-prod-asia-south1',
  response: {
    name: 'bemmoly-prod-asia-south1',
    status: 'RUNNING',
    endpoint: '34.118.10.2',
    masterAuth: { clusterCaCertificate: Buffer.from('recorded-ca').toString('base64') },
    workloadIdentityConfig: { workloadPool: 'acme-commerce-prod.svc.id.goog' },
    secretManagerConfig: secretManager ? { enabled: true } : {},
    secretSyncConfig: sync ? { enabled: true } : {},
  },
});

const applied = (path: string, name: string): RecordedExchange => ({
  method: 'PATCH',
  url: `${KUBE}${path}/${name}${APPLY}`,
  response: { metadata: { name } },
});

const opening: RecordedExchange[] = [
  {
    method: 'POST',
    url: 'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/deployer@acme-commerce-prod.iam.gserviceaccount.com:generateAccessToken',
    repeat: true,
    response: { accessToken: 'ya29.deployer', expireTime: '2099-01-01T00:00:00Z' },
  },
  {
    method: 'GET',
    url: `${KUBE}/api/v1/namespaces/checkout`,
    response: { metadata: { name: 'checkout' } },
  },
  {
    method: 'PATCH',
    url: `${NS}/gateways/bemmoly${APPLY}`,
    response: { metadata: { name: 'bemmoly' } },
  },
];

function recording(exchanges: RecordedExchange[]) {
  const replay = createReplayTransport(exchanges);
  const sent: Array<{ method: string; url: string; body: unknown }> = [];
  const transport: GcpTransport = (url, init) => {
    sent.push({ method: init.method, url, body: init.body ? JSON.parse(init.body) : undefined });
    return replay.transport(url, init);
  };
  const provider = createGcpProvider({
    transport,
    tokensFor: () => fixedTokens(),
    kubernetesTransport: () => transport,
  });
  const targets = provider.runtimes?.['gke-autopilot']?.targets;
  if (!targets) throw new Error('No GKE targets');
  return { targets, replay, sent };
}

/** Everything a Prod deploy of one revision with one secret sends, in order. */
function deployExchanges(sync: boolean): RecordedExchange[] {
  return [
    cluster(true),
    ...opening,
    applied('/api/v1/namespaces/checkout/serviceaccounts', 'checkout-api'),
    {
      method: 'GET',
      url: 'https://cloudresourcemanager.googleapis.com/v3/projects/acme-commerce-prod',
      response: { name: 'projects/481920334412', projectId: 'acme-commerce-prod' },
    },
    { method: 'GET', url: `${SM}/${SECRET}:getIamPolicy`, response: { etag: 'BwY=' } },
    {
      method: 'POST',
      url: `${SM}/${SECRET}:setIamPolicy`,
      body: {
        policy: {
          bindings: [{ role: 'roles/secretmanager.secretAccessor', members: [PRINCIPAL] }],
        },
      },
      response: { etag: 'BwZ=' },
    },
    applied(
      '/apis/secrets-store.csi.x-k8s.io/v1/namespaces/checkout/secretproviderclasses',
      REVISION,
    ),
    ...(sync
      ? [applied('/apis/secret-sync.gke.io/v1/namespaces/checkout/secretsyncs', REVISION)]
      : []),
    applied('/apis/apps/v1/namespaces/checkout/deployments', REVISION),
    applied('/api/v1/namespaces/checkout/services', REVISION),
    applied('/apis/autoscaling/v2/namespaces/checkout/horizontalpodautoscalers', REVISION),
    applied('/apis/policy/v1/namespaces/checkout/poddisruptionbudgets', REVISION),
    { method: 'GET', url: `${NS}/httproutes/checkout-api`, status: 404, response: {} },
    {
      method: 'GET',
      url: `${KUBE}/apis/apps/v1/namespaces/checkout/deployments`,
      response: { items: [{ metadata: { name: REVISION } }] },
    },
    applied('/apis/gateway.networking.k8s.io/v1/namespaces/checkout/httproutes', 'checkout-api'),
    applied('/api/v1/namespaces/checkout/services', 'checkout-api'),
    { method: 'GET', url: `${NS}/gateways/bemmoly`, response: { metadata: { name: 'bemmoly' } } },
  ];
}

const ADDRESS = {
  url: 'http://checkout-api.checkout.svc.cluster.local:8080',
  publicUrl: null,
};

function bodies(sent: Array<{ url: string; body: unknown }>) {
  const body = (path: string) =>
    sent.find((entry) => entry.url.includes(path))?.body as { spec: Record<string, unknown> };
  const pod = (body('/deployments/').spec['template'] as { spec: Record<string, unknown> }).spec;
  const [container] = pod['containers'] as Array<Record<string, unknown>>;
  return { body, pod, container };
}

describe('a GKE deploy with a secret', () => {
  it('syncs the secret at its version into a Secret the container reads as a variable', async () => {
    const { targets, replay, sent } = recording(deployExchanges(true));
    expect(await targets.deploy(target, release(), variables)).toEqual({
      revision: REVISION,
      address: ADDRESS,
    });
    replay.verify({ allUsed: true });
    const { body, pod, container } = bodies(sent);
    expect(body('/secretsyncs/').spec).toEqual({
      serviceAccountName: 'checkout-api',
      secretProviderClassName: REVISION,
      secretObject: { type: 'Opaque', data: [{ sourcePath: 'API_KEY', targetKey: 'API_KEY' }] },
    });
    expect(pod['serviceAccountName']).toBe('checkout-api');
    expect(pod).not.toHaveProperty('volumes');
    expect(container?.['env']).toEqual([
      { name: 'API_KEY', valueFrom: { secretKeyRef: { name: REVISION, key: 'API_KEY' } } },
      { name: 'GREETING', value: 'hello' },
    ]);
  });

  it('mounts the secret at its version when the file says secretsAs files', async () => {
    const { targets, replay, sent } = recording(deployExchanges(false));
    expect(await targets.deploy(target, release('files'), variables)).toEqual({
      revision: REVISION,
      address: ADDRESS,
    });
    replay.verify({ allUsed: true });
    const { body, pod, container } = bodies(sent);
    expect(body('/secretproviderclasses/').spec).toEqual({
      provider: 'gke',
      parameters: {
        secrets: `- resourceName: "projects/acme-commerce-prod/secrets/${SECRET}/versions/3"\n  path: "API_KEY"\n`,
      },
    });
    expect(pod['serviceAccountName']).toBe('checkout-api');
    expect(pod['volumes']).toEqual([
      {
        name: 'bemmoly-secrets',
        csi: {
          driver: 'secrets-store-gke.csi.k8s.io',
          readOnly: true,
          volumeAttributes: { secretProviderClass: REVISION },
        },
      },
    ]);
    expect(container?.['env']).toEqual([
      { name: 'API_KEY_FILE', value: '/var/run/secrets/bemmoly/API_KEY' },
      { name: 'GREETING', value: 'hello' },
    ]);
    expect(JSON.stringify(sent)).not.toContain('secretKeyRef');
  });

  it('refuses a cluster without the Secret Manager add-on, saying what to turn on', async () => {
    const { targets } = recording([cluster(false), ...opening]);
    await expect(targets.deploy(target, release(), variables)).rejects.toThrow(
      'Turn on the Secret Manager add-on on bemmoly-prod-asia-south1 so applications there can read their secrets: gcloud container clusters update bemmoly-prod-asia-south1 --location asia-south1 --enable-secret-manager',
    );
  });

  it('refuses secrets as variables on a cluster without secret sync, naming both ways out', async () => {
    const { targets } = recording([cluster(true, false), ...opening]);
    await expect(targets.deploy(target, release(), variables)).rejects.toThrow(
      'Turn on secret sync on bemmoly-prod-asia-south1 so applications there can read secrets as environment variables: gcloud container clusters update bemmoly-prod-asia-south1 --location asia-south1 --enable-secret-sync. Or set secretsAs to files',
    );
  });
});

describe('secret mounts', () => {
  it('never replaces a plain variable that has the _FILE name already', () => {
    expect(
      containerEnv(
        [
          { name: 'API_KEY_FILE', kind: 'plain', value: '/custom' },
          { name: 'API_KEY', kind: 'secret', account: 'p', secret: 's', version: '1' },
        ],
        'files',
      ),
    ).toEqual([{ name: 'API_KEY_FILE', value: '/custom' }]);
  });

  it('quotes every name and path it writes into the class', () => {
    const manifest = secretClassManifest({
      revision: 'r',
      namespace: 'n',
      labels: {},
      secrets: [{ name: 'A', kind: 'secret', account: 'p', secret: 's"x', version: 'latest' }],
    });
    expect((manifest.spec?.['parameters'] as { secrets: string }).secrets).toContain(
      'resourceName: "projects/p/secrets/s\\"x/versions/latest"',
    );
  });
});
