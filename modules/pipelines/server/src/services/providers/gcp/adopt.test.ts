import { afterAll, describe, expect, it } from 'vitest';
import { createReplayTransport, fixedTokens, loadFixture } from '../../../testing/gcp-replay.ts';
import type { ConnectionRecord, DeployTarget } from '../contract.ts';
import { createGcpProvider } from './index.ts';

/*
 * Reading Cloud Run services that already run, against written answers (shapes from the
 * Cloud Run, Secret Manager and Resource Manager REST references, not captured from a live
 * project): every page of services, a secret's "latest" pinned to its number without its
 * value, a tag resolved to its digest, and a secret in another project named by number.
 */

const connection: ConnectionRecord = {
  id: '0199f0aa-0000-7000-8000-0000000000b2',
  provider: 'gcp',
  name: 'Acme Shop Google Cloud',
  layout: 'per-environment',
  boundaryRef: null,
  config: { mode: 'attached', region: 'europe-west1', credentials: { kind: 'metadata' } },
};

const place = { account: 'acme-shop-stage', region: 'europe-west1', accountConfig: {} };

const replay = createReplayTransport(loadFixture('cloud-run-adopt'));
const adopt = createGcpProvider({
  transport: replay.transport,
  tokensFor: () => fixedTokens(),
  poll: { intervalMs: 0, sleep: async () => {} },
}).adopt;

const target = (overrides: Partial<DeployTarget> = {}): DeployTarget => ({
  connection,
  environment: { id: 'e', key: 'prod', class: 'prod', region: 'europe-west1' },
  account: { externalId: 'acme-shop-prod', name: 'Shop prod', config: {} },
  application: { id: 'a', key: 'cart-api', runtime: 'container-service' },
  ...overrides,
});

describe('Cloud Run services that already run', () => {
  afterAll(() => replay.verify({ allUsed: true }));

  it('lists every page, with settings, secrets by version and images by digest', async () => {
    const services = await adopt?.listServices(connection, place);
    expect(services?.map((service) => service.name)).toEqual([
      'cart-api',
      'checkout-api',
      'nightly-report',
    ]);
    const [cart, checkout, worker] = services ?? [];
    expect(cart).toEqual({
      name: 'cart-api',
      urls: [
        'https://cart-api-q4m2vt7nba-ew.a.run.app',
        'https://cart-api-771205334230.europe-west1.run.app',
      ],
      revision: 'cart-api-00012-vqd',
      image: {
        repository: 'europe-west1-docker.pkg.dev/acme-shop-stage/apps/cart-api',
        digest: `sha256:${'3c'.repeat(32)}`,
      },
      variables: [
        { name: 'LOG_LEVEL', kind: 'plain', value: 'info' },
        {
          name: 'DB_PASSWORD',
          kind: 'secret',
          account: 'acme-shop-stage',
          secret: 'cart-db-password',
          version: '3',
        },
      ],
      settings: {
        'scaling.min': 0,
        'scaling.max': 5,
        'scaling.concurrency': 80,
        'resources.cpu': '1',
        'resources.memory': '512Mi',
        port: 8080,
        'healthcheck.path': '/healthz',
        'healthcheck.ready': '/ready',
      },
    });
    expect(checkout?.revision).toBe('checkout-api-00031-xkt');
    expect(checkout?.image?.digest).toBe(`sha256:${'7e'.repeat(32)}`);
    expect(checkout?.variables[1]).toEqual({
      name: 'PAYMENTS_KEY',
      kind: 'secret',
      account: 'acme-shop-shared',
      secret: 'payments-key',
      version: '2',
    });
    expect(checkout?.settings).toEqual({ 'scaling.max': 10, port: 3000 });
    expect(worker).toMatchObject({
      variables: [],
      settings: {},
      revision: 'nightly-report-00002-baw',
    });
  });

  it('reads one service by name, and none that is not there', async () => {
    expect((await adopt?.readService(connection, place, 'cart-api'))?.revision).toBe(
      'cart-api-00012-vqd',
    );
    expect(await adopt?.readService(connection, place, 'billing-api')).toBeNull();
  });

  it('names who a target runs as, on Cloud Run and on GKE', async () => {
    expect(await adopt?.runtimePrincipal(target())).toBe(
      '771205334231-compute@developer.gserviceaccount.com',
    );
    expect(
      await adopt?.runtimePrincipal(
        target({
          account: {
            externalId: 'acme-shop-prod',
            name: 'p',
            config: { runtimeServiceAccount: 'run@acme-shop-prod.iam.gserviceaccount.com' },
          },
        }),
      ),
    ).toBe('run@acme-shop-prod.iam.gserviceaccount.com');
    const cluster = {
      id: 'k',
      origin: 'created' as const,
      mode: 'autopilot' as const,
      projectId: 'acme-shop-prod',
      location: 'europe-west1',
      name: 'bemmoly-prod',
      gateway: null,
    };
    expect(
      await adopt?.runtimePrincipal(
        target({ placement: { runtime: 'gke-autopilot', cluster, namespace: 'cart' } }),
      ),
    ).toBe(
      'principal://iam.googleapis.com/projects/771205334231/locations/global/workloadIdentityPools/acme-shop-prod.svc.id.goog/subject/ns/cart/sa/cart-api',
    );
  });

  it('acted only as the connection, reading and never writing', () => {
    expect(replay.calls.every((call) => call.startsWith('GET '))).toBe(true);
  });
});
