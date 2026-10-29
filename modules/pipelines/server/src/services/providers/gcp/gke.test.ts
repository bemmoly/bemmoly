import { afterAll, describe, expect, it } from 'vitest';
import type { KubernetesTransport } from '../../../clients/kubernetes/index.ts';
import { describeTargetsConformance } from '../../../testing/provider-conformance.ts';
import {
  createReplayTransport,
  fixedTokens,
  GCP_PROD_TARGET,
  loadFixture,
} from '../../../testing/gcp-replay.ts';
import type { CloudProvider, DeployTarget, ReleaseArtifact } from '../contract.ts';
import { createGcpProvider } from './index.ts';

/*
 * GKE against recorded answers: the conformance kit through the Gateway API's weights, then
 * what the replay shows about how it got there (server-side apply as one field manager, the
 * deployer's token, the oldest idle revision pruned, the canary read from the load balancer).
 */

const IMAGE = 'asia-south1-docker.pkg.dev/acme-ci/apps/checkout-api';

const release = (version: string, commitSha: string, digit: string): ReleaseArtifact => ({
  id: `00000000-0000-7000-8000-00000000000${digit}`,
  version,
  commitSha,
  imageRepository: IMAGE,
  imageDigests: { 'linux/amd64': `sha256:${digit.repeat(64)}` },
  resolvedConfig: { deploy: { port: 8081, resources: { cpu: '500m', memory: '512Mi' } } },
});

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

const replay = createReplayTransport(loadFixture('gke-rollout'));
const kubeRequests: Array<{ method: string; url: string; headers: Record<string, string> }> = [];
const kubernetesTransport = (): KubernetesTransport => (url, init) => {
  kubeRequests.push({ method: init.method, url, headers: init.headers });
  return replay.transport(url, init);
};
const gcp = createGcpProvider({
  transport: replay.transport,
  tokensFor: () => fixedTokens(),
  poll: { intervalMs: 0, sleep: async () => {} },
  kubernetesTransport,
});
const gke = gcp.runtimes?.['gke-autopilot'];
const provider: CloudProvider = {
  ...gcp,
  ...(gke ? { targets: gke.targets } : {}),
  ...(gke?.metrics ? { metrics: gke.metrics } : {}),
};

describeTargetsConformance('gke', async () => ({
  provider,
  target,
  stable: release('v1.42.0', 'b7d2e91', '1'),
  next: release('v2.0.0', 'c4e8a10', '2'),
}));

describe('the GKE rollout replay', () => {
  afterAll(() => replay.verify({ allUsed: true }));

  it('runs every Google and cluster call as the environment deployer', () => {
    expect(replay.calls[0]).toContain('deployer@acme-commerce-prod');
    expect(kubeRequests.length).toBeGreaterThan(20);
    expect(
      kubeRequests.every(
        (request) => request.headers['authorization'] === 'Bearer ya29.deployer-acme-commerce-prod',
      ),
    ).toBe(true);
  });

  it('writes by server-side apply under one field manager', () => {
    const patches = kubeRequests.filter((request) => request.method === 'PATCH');
    expect(patches.length).toBeGreaterThan(0);
    for (const patch of patches) {
      expect(patch.headers['content-type']).toBe('application/apply-patch+yaml');
      expect(new URL(patch.url).searchParams.get('fieldManager')).toBe('bemmoly-pipelines');
    }
  });

  it('prunes the oldest idle revision and keeps two to roll back to', () => {
    const deletes = replay.calls.filter((call) => call.startsWith('DELETE'));
    expect(deletes).toContain(
      'DELETE /apis/apps/v1/namespaces/checkout/deployments/checkout-api-v1-39-0-9a9a9a9',
    );
    expect(deletes.some((call) => call.includes('v1-40-0') || call.includes('v1-41-0'))).toBe(
      false,
    );
  });
});

describe('GKE canary numbers', () => {
  it('counts 500s over all answers, as Cloud Run counts 5xx', async () => {
    const exchanges = loadFixture('gke-rollout').filter(
      (exchange) =>
        exchange.url.includes('generateAccessToken') || exchange.url.includes('timeSeries'),
    );
    const filters: string[] = [];
    const replayed = createReplayTransport(exchanges);
    const metrics = createGcpProvider({
      transport: (url, init) => {
        const filter = new URL(url).searchParams.get('filter');
        if (filter) filters.push(filter);
        return replayed.transport(url, init);
      },
      tokensFor: () => fixedTokens(),
    }).runtimes?.['gke-autopilot']?.metrics;
    const to = new Date('2026-10-29T09:05:00Z');
    const result = await metrics?.revision(target, 'checkout-api-v2-0-0-c4e8a10', 'error_rate', {
      from: new Date(to.getTime() - 5 * 60e3),
      to,
    });
    expect(result?.requests).toBe(800);
    expect(result?.value).toBeCloseTo(4 / 800);
    expect(filters[0]).toContain('loadbalancing.googleapis.com/https/backend_request_count');
    expect(filters[0]).toContain('has_substring("-checkout-checkout-api-v2-0-0-c4e8a10-")');
    expect(await metrics?.errorBudget(target)).toBeNull();
    replayed.verify({ allUsed: true });
  });
});
