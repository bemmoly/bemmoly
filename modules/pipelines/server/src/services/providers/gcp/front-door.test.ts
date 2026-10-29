import { afterAll, describe, expect, it } from 'vitest';
import type { KubernetesTransport } from '../../../clients/kubernetes/index.ts';
import {
  createReplayTransport,
  fixedTokens,
  GCP_PROD_TARGET,
  loadFixture,
} from '../../../testing/gcp-replay.ts';
import type { DeployTarget } from '../contract.ts';
import type { FrontDoorSpec } from '../front-door-contract.ts';
import { computeName, withHost } from './front-door-map.ts';
import { createGcpProvider } from './index.ts';

/*
 * The front door against recorded answers: an address reserved, checkout-api's host routed to
 * Cloud Run through a serverless NEG behind a managed certificate, then split 90/10 with a
 * GKE revision through its standalone NEGs, then moved to GKE whole, and Cloud Run left.
 */

const HOST = 'checkout-api.prod.acme.example';
const REVISION = 'checkout-api-v2-0-0-c4e8a10';

const door: FrontDoorSpec = {
  environment: 'prod-asia-south1',
  account: { externalId: 'acme-commerce-prod' },
  region: 'asia-south1',
  domain: 'prod.acme.example',
};

const onGke: DeployTarget = {
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

const replay = createReplayTransport(loadFixture('front-door'));
const kubeHeaders: Array<Record<string, string>> = [];
const kubernetesTransport = (): KubernetesTransport => (url, init) => {
  kubeHeaders.push(init.headers);
  return replay.transport(url, init);
};
const frontDoor = createGcpProvider({
  transport: replay.transport,
  tokensFor: () => fixedTokens(),
  poll: { intervalMs: 0, sleep: async () => {} },
  kubernetesTransport,
}).frontDoor;
const part = () => {
  if (!frontDoor) throw new Error('Google Cloud has no front door');
  return frontDoor;
};
const connection = GCP_PROD_TARGET.connection;

describe('the Google Cloud front door', () => {
  afterAll(() => replay.verify({ allUsed: true }));

  it('reserves one address for the environment', async () => {
    expect(await part().ensure(connection, door, [])).toEqual({
      address: '34.120.1.10',
      problems: [],
    });
  });

  it('routes a host to Cloud Run behind a managed certificate on 443', async () => {
    await part().route(connection, door, {
      application: 'checkout-api',
      host: HOST,
      backends: [{ target: GCP_PROD_TARGET, revision: null, percent: 100 }],
    });
    expect(replay.calls).toContain(
      'GET /compute/v1/projects/acme-commerce-prod/regions/asia-south1/operations/operation-neg',
    );
  });

  it('splits the host with a GKE revision through its standalone NEGs', async () => {
    await part().route(connection, door, {
      application: 'checkout-api',
      host: HOST,
      backends: [
        { target: GCP_PROD_TARGET, revision: null, percent: 90 },
        { target: onGke, revision: REVISION, percent: 10 },
      ],
    });
    expect(kubeHeaders[0]?.['authorization']).toBe('Bearer ya29.deployer-acme-commerce-prod');
  });

  it('moves the host to GKE whole and drops the Cloud Run backend', async () => {
    await part().route(connection, door, {
      application: 'checkout-api',
      host: HOST,
      backends: [{ target: onGke, revision: REVISION, percent: 100 }],
    });
    expect(replay.calls).toContain(
      'DELETE /compute/v1/projects/acme-commerce-prod/global/backendServices/bm-prod-asia-south1-checkout-api-run',
    );
  });

  it('leaves Cloud Run: the service and its serverless NEG go', async () => {
    await part().leave(GCP_PROD_TARGET);
    expect(replay.calls).toContain(
      'DELETE /v2/projects/acme-commerce-prod/locations/asia-south1/services/checkout-api',
    );
  });

  it('says what to do while a certificate is still being issued', async () => {
    const state = await part().ensure(connection, door, [HOST]);
    expect(state.problems).toEqual([
      `The certificate for ${HOST} is not issued yet. Point ${HOST} at 34.120.1.10; Google issues it once DNS answers there`,
    ]);
  });
});

describe('front door names and maps', () => {
  it('keep names to 63 characters, a letter first, and distinct when shortened', () => {
    const long = computeName('fd', 'checkout', 'a'.repeat(80), '80');
    expect(long).toHaveLength(63);
    expect(long).not.toBe(computeName('fd', 'checkout', 'b'.repeat(80), '80'));
    expect(computeName('9lives', 'x')).toBe('bm-9lives-x');
  });

  it('replace one host and keep the others, defaulting to the first host', () => {
    const map = withHost(null, 'fd', 'b.example', [{ link: 'x/bs-b', weight: 100 }]);
    const both = withHost({ ...map, fingerprint: 'f' }, 'fd', 'a.example', [
      { link: 'x/bs-a1', weight: 30 },
      { link: 'x/bs-a2', weight: 70 },
    ]);
    expect(both.hostRules.map((rule) => rule.hosts[0])).toEqual(['a.example', 'b.example']);
    expect(both.defaultService).toBe('x/bs-a2');
    expect(both.fingerprint).toBe('f');
    const again = withHost(both, 'fd', 'a.example', [{ link: 'x/bs-a2', weight: 100 }]);
    expect(again.pathMatchers).toHaveLength(2);
  });
});
