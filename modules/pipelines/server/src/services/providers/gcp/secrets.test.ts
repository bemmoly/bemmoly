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
 * Secrets against written answers (shapes from the Secret Manager and Cloud Run v2 REST
 * references, not captured from a live project): reading one version back for a CI job, and
 * a revision that reads each secret at its recorded version, after whoever it runs as has
 * been granted access.
 */

const RM = 'https://cloudresourcemanager.googleapis.com/v3';
const SM = 'https://secretmanager.googleapis.com/v1';
const RUN = 'https://run.googleapis.com/v2';
const PROJECT = 'nila-shop-prod';
const CI = 'nila-ci';
const SERVICE = `projects/${PROJECT}/locations/europe-west1/services/storefront`;
const ACCESSOR = 'roles/secretmanager.secretAccessor';

const connection: ConnectionRecord = {
  id: '0199f0aa-0000-7000-8000-0000000000a1',
  provider: 'gcp',
  name: 'Nila Google Cloud',
  layout: 'per-environment',
  boundaryRef: null,
  config: { mode: 'attached', region: 'europe-west1', credentials: { kind: 'metadata' } },
};

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

const target = (runtimeServiceAccount: string | null): DeployTarget => ({
  connection,
  environment: { id: 'e', key: 'prod', class: 'prod', region: null },
  account: { externalId: PROJECT, name: 'Nila Shop Prod', config: { runtimeServiceAccount } },
  application: { id: 'a', key: 'storefront', runtime: 'container-service' },
});

const release: ReleaseArtifact = {
  id: '00000000-0000-7000-8000-000000000001',
  version: 'a1c9e3f',
  commitSha: 'a1c9e3f0',
  imageRepository: 'europe-west1-docker.pkg.dev/nila-ci/apps/storefront',
  imageDigests: { 'linux/amd64': `sha256:${'2'.repeat(64)}` },
  resolvedConfig: { deploy: { kind: 'container-service', port: 3000 } },
};

const variables: DeployVariable[] = [
  { name: 'LOG_LEVEL', kind: 'plain', value: 'info' },
  {
    name: 'API_KEY',
    kind: 'secret',
    account: PROJECT,
    secret: 'bemmoly-storefront-API_KEY-prod',
    version: '3',
  },
  {
    name: 'SENTRY_DSN',
    kind: 'secret',
    account: CI,
    secret: 'bemmoly-storefront-SENTRY_DSN',
    version: '1',
  },
];

const policy = (project: string, secret: string, members: string[]): RecordedExchange => ({
  method: 'GET',
  url: `${SM}/projects/${project}/secrets/${secret}:getIamPolicy`,
  response: members.length > 0 ? { etag: 'BwA1', bindings: [{ role: ACCESSOR, members }] } : {},
});

const created = { name: SERVICE, template: {}, traffic: [], trafficStatuses: [] };

describe('Secret Manager for CI jobs', () => {
  it('reads one version back, decoded, with a GET on that version only', async () => {
    const { provider, replay } = recording([
      {
        method: 'GET',
        url: `${SM}/projects/${CI}/secrets/bemmoly-storefront-NPM_TOKEN/versions/2:access`,
        response: {
          name: 'projects/829302/secrets/bemmoly-storefront-NPM_TOKEN/versions/2',
          payload: { data: Buffer.from('not-a-real-token').toString('base64') },
        },
      },
    ]);
    const value = await provider.secrets!.accessVersion!(connection, {
      account: CI,
      name: 'bemmoly-storefront-NPM_TOKEN',
      version: '2',
    });
    expect(value).toBe('not-a-real-token');
    replay.verify({ allUsed: true });
  });
});

describe('a revision with secrets', () => {
  it('grants the default compute account and pins every secret to its version', async () => {
    const { provider, replay, bodies } = recording([
      {
        method: 'GET',
        url: `${RM}/projects/${PROJECT}`,
        response: { name: 'projects/829301', projectId: PROJECT },
      },
      policy(PROJECT, 'bemmoly-storefront-API_KEY-prod', []),
      {
        method: 'POST',
        url: `${SM}/projects/${PROJECT}/secrets/bemmoly-storefront-API_KEY-prod:setIamPolicy`,
        body: {
          policy: {
            bindings: [
              {
                role: ACCESSOR,
                members: ['serviceAccount:829301-compute@developer.gserviceaccount.com'],
              },
            ],
          },
        },
        response: { etag: 'BwA2' },
      },
      // Already granted: no second write.
      policy(CI, 'bemmoly-storefront-SENTRY_DSN', [
        'serviceAccount:829301-compute@developer.gserviceaccount.com',
      ]),
      {
        method: 'GET',
        url: `${RUN}/${SERVICE}`,
        status: 404,
        response: { error: { message: 'not found' } },
      },
      {
        method: 'POST',
        url: `${RUN}/projects/${PROJECT}/locations/europe-west1/services?serviceId=storefront`,
        response: { name: 'operations/op1', done: true, response: created },
      },
    ]);
    await provider.targets!.deploy(target(null), release, variables);
    const create = bodies.find((call) => call.method === 'POST' && call.url.includes('/services?'));
    const template = (create?.body as { template: { containers: Array<Record<string, unknown>> } })
      .template;
    expect(template.containers[0]?.['env']).toEqual([
      { name: 'LOG_LEVEL', value: 'info' },
      {
        name: 'API_KEY',
        valueSource: { secretKeyRef: { secret: 'bemmoly-storefront-API_KEY-prod', version: '3' } },
      },
      {
        name: 'SENTRY_DSN',
        valueSource: {
          secretKeyRef: {
            secret: `projects/${CI}/secrets/bemmoly-storefront-SENTRY_DSN`,
            version: '1',
          },
        },
      },
    ]);
    expect(JSON.stringify(bodies)).not.toContain('not-a-real');
    replay.verify({ allUsed: true });
  });

  it('grants the runtime account an attached project names, and drops values set by hand', async () => {
    const runtime = 'runtime@nila-shop-prod.iam.gserviceaccount.com';
    const { provider, replay, bodies } = recording([
      policy(PROJECT, 'bemmoly-storefront-API_KEY-prod', [`serviceAccount:${runtime}`]),
      policy(CI, 'bemmoly-storefront-SENTRY_DSN', [`serviceAccount:${runtime}`]),
      {
        method: 'GET',
        url: `${RUN}/${SERVICE}`,
        response: {
          ...created,
          etag: 'e1',
          template: {
            containers: [{ image: 'old', env: [{ name: 'SET_IN_CONSOLE', value: 'x' }] }],
          },
          latestReadyRevision: 'storefront-old',
          traffic: [{ type: 'TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST', percent: 100 }],
        },
      },
      {
        method: 'PATCH',
        url: `${RUN}/${SERVICE}`,
        response: { name: 'operations/op2', done: true, response: created },
      },
    ]);
    await provider.targets!.deploy(target(runtime), release, variables.slice(1));
    const update = bodies.find((call) => call.method === 'PATCH');
    const template = (
      update?.body as {
        template: { serviceAccount: string; containers: Array<Record<string, unknown>> };
      }
    ).template;
    expect(template.serviceAccount).toBe(runtime);
    expect((template.containers[0]?.['env'] as Array<{ name: string }>).map((e) => e.name)).toEqual(
      ['API_KEY', 'SENTRY_DSN'],
    );
    expect(replay.calls.some((call) => call.includes('cloudresourcemanager'))).toBe(false);
    replay.verify({ allUsed: true });
  });
});
