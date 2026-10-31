import { describe, expect, it } from 'vitest';
import type { GcpTransport } from '../../../clients/gcp/index.ts';
import {
  createReplayTransport,
  fixedTokens,
  type RecordedExchange,
} from '../../../testing/gcp-replay.ts';
import type {
  ConnectionRecord,
  DeployTarget,
  DeployVariable,
  ReleaseArtifact,
} from '../contract.ts';
import { createGcpProvider } from './index.ts';

/*
 * Deploy settings on Cloud Run against written answers (shapes from the Cloud Run v2 REST
 * reference, not captured from a live project): scaling and concurrency on the revision, the
 * startup probe on the readiness path and the liveness probe on the health path, secrets as
 * files, and the run.app address the deploy answers with.
 */

const RUN = 'https://run.googleapis.com/v2';
const PROJECT = 'acme-shop-staging';
const SERVICE = `projects/${PROJECT}/locations/europe-west1/services/storefront`;
const URI = 'https://storefront-829301.europe-west1.run.app';

const connection: ConnectionRecord = {
  id: '0199f0aa-0000-7000-8000-0000000000a1',
  provider: 'gcp',
  name: 'Acme Google Cloud',
  layout: 'per-environment',
  boundaryRef: null,
  config: { mode: 'attached', region: 'europe-west1', credentials: { kind: 'metadata' } },
};

const target: DeployTarget = {
  connection,
  environment: { id: 'e', key: 'staging', class: 'staging', region: null },
  account: {
    externalId: PROJECT,
    name: 'Acme Shop Staging',
    config: { runtimeServiceAccount: 'runtime@acme-shop-staging.iam.gserviceaccount.com' },
  },
  application: { id: 'a', key: 'storefront', runtime: 'container-service' },
};

const release = (deploy: Record<string, unknown>): ReleaseArtifact => ({
  id: '00000000-0000-7000-8000-000000000001',
  version: 'v1.2.0',
  commitSha: 'a1c9e3f0',
  imageRepository: 'europe-west1-docker.pkg.dev/acme-ci/apps/storefront',
  imageDigests: { 'linux/amd64': `sha256:${'2'.repeat(64)}` },
  resolvedConfig: { deploy },
});

const served = { name: SERVICE, uri: URI, template: {}, traffic: [], trafficStatuses: [] };

function recording(exchanges: RecordedExchange[]) {
  const replay = createReplayTransport(exchanges);
  const bodies: Array<{ method: string; url: string; body: unknown }> = [];
  const transport: GcpTransport = (url, init) => {
    bodies.push({ method: init.method, url, body: init.body ? JSON.parse(init.body) : undefined });
    return replay.transport(url, init);
  };
  const provider = createGcpProvider({
    transport,
    tokensFor: () => fixedTokens(),
    poll: { intervalMs: 0, sleep: async () => {} },
  });
  const template = () => {
    const sent = bodies.find((call) => call.method === 'POST' || call.method === 'PATCH');
    return (sent?.body as { template: Record<string, unknown> }).template;
  };
  return { provider, replay, template };
}

const missing: RecordedExchange = {
  method: 'GET',
  url: `${RUN}/${SERVICE}`,
  status: 404,
  response: { error: { message: 'not found' } },
};
const create: RecordedExchange = {
  method: 'POST',
  url: `${RUN}/projects/${PROJECT}/locations/europe-west1/services?serviceId=storefront`,
  response: { name: 'operations/op1', done: true, response: served },
};

describe('deploy settings on Cloud Run', () => {
  it('starts at zero instances and probes readiness and liveness on their own paths', async () => {
    const { provider, replay, template } = recording([missing, create]);
    const result = await provider.targets!.deploy(
      target,
      release({
        port: 3000,
        healthcheck: { path: '/healthz', ready: '/ready', timeoutSeconds: 4 },
        scaling: { max: 5, concurrency: 40 },
      }),
    );
    expect(result.address).toEqual({ url: URI, publicUrl: null });
    const sent = template();
    expect(sent['scaling']).toEqual({ minInstanceCount: 0, maxInstanceCount: 5 });
    expect(sent['maxInstanceRequestConcurrency']).toBe(40);
    const [container] = sent['containers'] as Array<Record<string, unknown>>;
    expect(container?.['ports']).toEqual([{ containerPort: 3000 }]);
    expect(container?.['startupProbe']).toEqual({
      httpGet: { path: '/ready' },
      timeoutSeconds: 4,
      periodSeconds: 10,
    });
    expect(container?.['livenessProbe']).toEqual({
      httpGet: { path: '/healthz' },
      timeoutSeconds: 4,
      periodSeconds: 10,
    });
    replay.verify({ allUsed: true });
  });

  it('takes the settings resolved for the environment over the file', async () => {
    const { provider, replay, template } = recording([missing, create]);
    const settled: ReleaseArtifact = {
      ...release({ scaling: { min: 0 } }),
      settings: {
        scaling: { min: 1, max: 3, concurrency: null, cpuTarget: null },
        resources: { cpu: '2', memory: '1Gi' },
        port: 8080,
        healthcheck: { path: '/healthz', ready: null, timeoutSeconds: 5 },
        secretsAs: 'env',
        maxUnavailable: null,
        public: false,
      },
    };
    await provider.targets!.deploy(target, settled);
    const sent = template();
    expect(sent['scaling']).toEqual({ minInstanceCount: 1, maxInstanceCount: 3 });
    expect(sent).not.toHaveProperty('maxInstanceRequestConcurrency');
    const [container] = sent['containers'] as Array<Record<string, unknown>>;
    expect(container?.['resources']).toEqual({ limits: { cpu: '2', memory: '1Gi' } });
    expect(container?.['startupProbe']).toMatchObject({ httpGet: { path: '/healthz' } });
    replay.verify({ allUsed: true });
  });

  it('mounts each secret at its version as a file when the file says so', async () => {
    const variables: DeployVariable[] = [
      { name: 'LOG_LEVEL', kind: 'plain', value: 'info' },
      {
        name: 'API_KEY',
        kind: 'secret',
        account: PROJECT,
        secret: 'bemmoly-api-key',
        version: '3',
      },
    ];
    const policy: RecordedExchange = {
      method: 'GET',
      url: `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/bemmoly-api-key:getIamPolicy`,
      response: {
        etag: 'BwA1',
        bindings: [
          {
            role: 'roles/secretmanager.secretAccessor',
            members: ['serviceAccount:runtime@acme-shop-staging.iam.gserviceaccount.com'],
          },
        ],
      },
    };
    const existing: RecordedExchange = {
      method: 'GET',
      url: `${RUN}/${SERVICE}`,
      response: {
        ...served,
        etag: 'e1',
        template: {
          volumes: [{ name: 'cache', emptyDir: {} }],
          containers: [{ image: 'old', volumeMounts: [{ name: 'cache', mountPath: '/cache' }] }],
        },
        latestReadyRevision: 'storefront-old',
        traffic: [{ type: 'TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST', percent: 100 }],
      },
    };
    const update: RecordedExchange = {
      method: 'PATCH',
      url: `${RUN}/${SERVICE}`,
      response: { name: 'operations/op2', done: true, response: served },
    };
    const { provider, replay, template } = recording([policy, existing, update]);
    await provider.targets!.deploy(target, release({ secretsAs: 'files' }), variables);
    const sent = template();
    expect(sent['volumes']).toEqual([
      { name: 'cache', emptyDir: {} },
      {
        name: 'secret-api-key',
        secret: { secret: 'bemmoly-api-key', items: [{ path: 'API_KEY', version: '3' }] },
      },
    ]);
    const [container] = sent['containers'] as Array<Record<string, unknown>>;
    expect(container?.['volumeMounts']).toEqual([
      { name: 'cache', mountPath: '/cache' },
      { name: 'secret-api-key', mountPath: '/var/run/secrets/bemmoly/API_KEY' },
    ]);
    expect(container?.['env']).toEqual([
      { name: 'LOG_LEVEL', value: 'info' },
      { name: 'API_KEY_FILE', value: '/var/run/secrets/bemmoly/API_KEY/API_KEY' },
    ]);
    replay.verify({ allUsed: true });
  });
});
