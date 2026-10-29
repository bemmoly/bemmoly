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
 * principal access to the secret, names its version in a SecretProviderClass and mounts it
 * through GKE's Secret Manager add-on. No value is sent anywhere, and a cluster without the
 * add-on is refused with what to turn on.
 */

const KUBE = 'https://34.118.10.2';
const NS = `${KUBE}/apis/gateway.networking.k8s.io/v1/namespaces/checkout`;
const APPLY = '?fieldManager=bemmoly-pipelines&force=true';
const SM = 'https://secretmanager.googleapis.com/v1/projects/acme-commerce-prod/secrets';
const REVISION = 'checkout-api-v2-0-0-c4e8a10';
const SECRET = 'bemmoly-checkout-api-API_KEY-prod';
const PRINCIPAL =
  'principal://iam.googleapis.com/projects/481920334412/locations/global/workloadIdentityPools/acme-commerce-prod.svc.id.goog/subject/ns/checkout/sa/checkout-api';

const release: ReleaseArtifact = {
  id: '00000000-0000-7000-8000-000000000002',
  version: 'v2.0.0',
  commitSha: 'c4e8a10',
  imageRepository: 'asia-south1-docker.pkg.dev/acme-ci/apps/checkout-api',
  imageDigests: { 'linux/amd64': `sha256:${'2'.repeat(64)}` },
  resolvedConfig: {},
};

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

const cluster = (secretManager: boolean): RecordedExchange => ({
  method: 'GET',
  url: 'https://container.googleapis.com/v1/projects/acme-commerce-prod/locations/asia-south1/clusters/bemmoly-prod-asia-south1',
  response: {
    name: 'bemmoly-prod-asia-south1',
    status: 'RUNNING',
    endpoint: '34.118.10.2',
    masterAuth: { clusterCaCertificate: Buffer.from('recorded-ca').toString('base64') },
    workloadIdentityConfig: { workloadPool: 'acme-commerce-prod.svc.id.goog' },
    secretManagerConfig: secretManager ? { enabled: true } : {},
  },
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

describe('a GKE deploy with a secret', () => {
  it('grants the pods read access and mounts the secret at its version', async () => {
    const { targets, replay, sent } = recording([
      cluster(true),
      ...opening,
      {
        method: 'PATCH',
        url: `${KUBE}/api/v1/namespaces/checkout/serviceaccounts/checkout-api${APPLY}`,
        response: { metadata: { name: 'checkout-api' } },
      },
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
      {
        method: 'PATCH',
        url: `${KUBE}/apis/secrets-store.csi.x-k8s.io/v1/namespaces/checkout/secretproviderclasses/${REVISION}${APPLY}`,
        response: { metadata: { name: REVISION } },
      },
      {
        method: 'PATCH',
        url: `${KUBE}/apis/apps/v1/namespaces/checkout/deployments/${REVISION}${APPLY}`,
        response: { metadata: { name: REVISION } },
      },
      {
        method: 'PATCH',
        url: `${KUBE}/api/v1/namespaces/checkout/services/${REVISION}${APPLY}`,
        response: { metadata: { name: REVISION } },
      },
      { method: 'GET', url: `${NS}/httproutes/checkout-api`, status: 404, response: {} },
      {
        method: 'GET',
        url: `${KUBE}/apis/apps/v1/namespaces/checkout/deployments`,
        response: { items: [{ metadata: { name: REVISION } }] },
      },
      {
        method: 'PATCH',
        url: `${NS}/httproutes/checkout-api${APPLY}`,
        response: { metadata: { name: 'checkout-api' } },
      },
    ]);
    expect(await targets.deploy(target, release, variables)).toEqual({ revision: REVISION });
    replay.verify({ allUsed: true });
    const body = (path: string) =>
      sent.find((entry) => entry.url.includes(path))?.body as {
        spec: Record<string, unknown>;
      };
    expect(body('/secretproviderclasses/').spec).toEqual({
      provider: 'gke',
      parameters: {
        secrets: `- resourceName: "projects/acme-commerce-prod/secrets/${SECRET}/versions/3"\n  path: "API_KEY"\n`,
      },
    });
    const pod = (body('/deployments/').spec['template'] as { spec: Record<string, unknown> }).spec;
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
    const [container] = pod['containers'] as Array<Record<string, unknown>>;
    expect(container?.['env']).toEqual([
      { name: 'API_KEY_FILE', value: '/var/run/secrets/bemmoly/API_KEY' },
      { name: 'GREETING', value: 'hello' },
    ]);
    expect(JSON.stringify(sent)).not.toContain('secretKeyRef');
  });

  it('refuses a cluster without the Secret Manager add-on, saying what to turn on', async () => {
    const { targets } = recording([cluster(false), ...opening]);
    await expect(targets.deploy(target, release, variables)).rejects.toThrow(
      'Turn on the Secret Manager add-on on bemmoly-prod-asia-south1 so applications there can read their secrets: gcloud container clusters update bemmoly-prod-asia-south1 --location asia-south1 --enable-secret-manager',
    );
  });
});

describe('secret mounts', () => {
  it('never replaces a plain variable that has the _FILE name already', () => {
    expect(
      containerEnv([
        { name: 'API_KEY_FILE', kind: 'plain', value: '/custom' },
        { name: 'API_KEY', kind: 'secret', account: 'p', secret: 's', version: '1' },
      ]),
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
