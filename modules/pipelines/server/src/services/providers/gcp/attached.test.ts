import { describe, expect, it } from 'vitest';
import type { GcpTransport } from '../../../clients/gcp/index.ts';
import {
  createReplayTransport,
  fixedTokens,
  type RecordedExchange,
} from '../../../testing/gcp-replay.ts';
import type { ConnectionRecord, DeployTarget, ReleaseArtifact } from '../contract.ts';
import { createGcpProvider } from './index.ts';

/*
 * Attached mode against written answers: checking a project that already exists, and deploying
 * into it as the connection's own identity, with the release's deploy settings on the revision.
 */

const RM = 'https://cloudresourcemanager.googleapis.com/v3';
const SU = 'https://serviceusage.googleapis.com/v1';
const RUN = 'https://run.googleapis.com/v2';
const PROJECT = 'nila-shop-prod';
const SERVICE = `projects/${PROJECT}/locations/europe-west1/services/storefront`;

const connection: ConnectionRecord = {
  id: '0199f0aa-0000-7000-8000-0000000000a1',
  provider: 'gcp',
  name: 'Nila Google Cloud',
  layout: 'per-environment',
  boundaryRef: null,
  config: { mode: 'attached', region: 'europe-west1', credentials: { kind: 'metadata' } },
};

const enabled = (...apis: string[]) => ({
  method: 'GET',
  url: `${SU}/projects/${PROJECT}/services`,
  response: {
    services: apis.map((api) => ({ name: `projects/1/services/${api}`, config: { name: api } })),
  },
});

const project: RecordedExchange = {
  method: 'GET',
  url: `${RM}/projects/${PROJECT}`,
  response: {
    name: 'projects/829301',
    projectId: PROJECT,
    displayName: 'Nila Shop Prod',
    state: 'ACTIVE',
  },
};

/** Captures request bodies too, so a test can say what was not sent. */
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
  return { provider, replay, bodies };
}

describe('attaching a project that already exists', () => {
  it('passes when Cloud Run is on and the deploy permissions are held, taking the project name', async () => {
    const { provider, replay } = recording([
      project,
      enabled('run.googleapis.com', 'monitoring.googleapis.com'),
      {
        method: 'POST',
        url: `${RM}/projects/${PROJECT}:testIamPermissions`,
        response: {
          permissions: [
            'run.services.get',
            'run.services.create',
            'run.services.update',
            'run.revisions.get',
            'run.revisions.delete',
            'iam.serviceAccounts.actAs',
            'monitoring.timeSeries.list',
          ],
        },
      },
    ]);
    const check = await provider.connection!.verifyAccount!(connection, {
      externalId: PROJECT,
      config: {},
    });
    expect(check).toEqual({ ok: true, name: 'Nila Shop Prod', problems: [] });
    // No deployer is named, so nothing is impersonated: the connection acts as itself.
    expect(replay.calls.some((call) => call.includes('generateAccessToken'))).toBe(false);
    replay.verify({ allUsed: true });
  });

  it('says what to turn on and grant, failing only on what would stop a deploy', async () => {
    const { provider, replay } = recording([
      project,
      enabled('compute.googleapis.com'),
      {
        method: 'POST',
        url: `${RM}/projects/${PROJECT}:testIamPermissions`,
        response: { permissions: ['run.services.get'] },
      },
    ]);
    const check = await provider.connection!.verifyAccount!(connection, {
      externalId: PROJECT,
      config: {},
    });
    expect(check.ok).toBe(false);
    expect(check.problems).toEqual([
      `Turn on the Cloud Run Admin API in ${PROJECT}`,
      `Grant Bemmoly Cloud Run Developer on ${PROJECT}`,
      `Grant Bemmoly Service Account User on ${PROJECT}, or on the account services run as`,
      `Turn on the Cloud Monitoring API in ${PROJECT} so canaries can read error rates`,
      `Grant Bemmoly Monitoring Viewer on ${PROJECT} so canaries can read error rates`,
    ]);
    replay.verify({ allUsed: true });
  });

  it('names a project it cannot see, with the role that fixes it', async () => {
    const { provider } = recording([
      {
        method: 'GET',
        url: `${RM}/projects/${PROJECT}`,
        status: 403,
        response: {
          error: { message: 'The caller does not have permission', status: 'PERMISSION_DENIED' },
        },
      },
    ]);
    const check = await provider.connection!.verifyAccount!(connection, {
      externalId: PROJECT,
      config: {},
    });
    expect(check).toEqual({
      ok: false,
      name: null,
      problems: [`Bemmoly cannot see project ${PROJECT}. Grant it Browser or Viewer there`],
    });
  });
});

describe('deploying into an attached project', () => {
  const target: DeployTarget = {
    connection,
    environment: { id: 'e', key: 'prod', class: 'prod', region: null },
    account: { externalId: PROJECT, name: 'Nila Shop Prod', config: {} },
    application: { id: 'a', key: 'storefront', runtime: 'container-service' },
  };
  const release: ReleaseArtifact = {
    id: '00000000-0000-7000-8000-000000000001',
    version: 'a1c9e3f',
    commitSha: 'a1c9e3f0',
    imageRepository: 'europe-west1-docker.pkg.dev/nila-ci/apps/storefront',
    imageDigests: { 'linux/amd64': `sha256:${'2'.repeat(64)}` },
    resolvedConfig: {
      deploy: {
        kind: 'container-service',
        port: 3000,
        resources: { cpu: 1, memory: '512Mi' },
        public: true,
      },
    },
  };
  const created = {
    name: SERVICE,
    uri: 'https://storefront-x1.a.run.app',
    template: {},
    traffic: [],
    trafficStatuses: [],
  };

  it('creates the service as the connection itself, with the release’s port, size and public access', async () => {
    const { provider, replay, bodies } = recording([
      {
        method: 'GET',
        url: `${RUN}/${SERVICE}`,
        status: 404,
        response: { error: { message: 'not found' } },
      },
      {
        method: 'POST',
        url: `${RUN}/projects/${PROJECT}/locations/europe-west1/services?serviceId=storefront`,
        response: {
          name: `projects/${PROJECT}/locations/europe-west1/operations/op1`,
          done: true,
          response: created,
        },
      },
      {
        method: 'GET',
        url: `${RUN}/${SERVICE}:getIamPolicy`,
        response: { etag: 'BwX1', bindings: [] },
      },
      {
        method: 'POST',
        url: `${RUN}/${SERVICE}:setIamPolicy`,
        body: { policy: { bindings: [{ role: 'roles/run.invoker', members: ['allUsers'] }] } },
        response: {
          etag: 'BwX2',
          bindings: [{ role: 'roles/run.invoker', members: ['allUsers'] }],
        },
      },
    ]);
    const { revision } = await provider.targets!.deploy(target, release);
    expect(revision).toBe('storefront-a1c9e3f-a1c9e3f');
    const create = bodies.find((call) => call.method === 'POST' && call.url.includes('/services?'));
    const template = (create?.body as { template: Record<string, unknown> }).template;
    // Attached with no runtime account named: Cloud Run's default, not runtime@<project>.
    expect(template).not.toHaveProperty('serviceAccount');
    expect(template['containers']).toEqual([
      {
        image: `europe-west1-docker.pkg.dev/nila-ci/apps/storefront@sha256:${'2'.repeat(64)}`,
        ports: [{ containerPort: 3000 }],
        resources: { limits: { cpu: '1', memory: '512Mi' } },
      },
    ]);
    expect(replay.calls.some((call) => call.includes('generateAccessToken'))).toBe(false);
    replay.verify({ allUsed: true });
  });

  it('refuses an image that never left the runner’s machine, saying how to fix it', async () => {
    const { provider } = recording([
      {
        method: 'GET',
        url: `${RUN}/${SERVICE}`,
        status: 404,
        response: { error: { message: 'not found' } },
      },
    ]);
    await expect(
      provider.targets!.deploy(target, { ...release, imageRepository: 'bemmoly-local/storefront' }),
    ).rejects.toThrow(/Set a registry on the Google Cloud connection/);
  });
});
