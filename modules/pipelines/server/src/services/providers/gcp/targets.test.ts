import { afterAll, describe, expect, it } from 'vitest';
import { describeTargetsConformance } from '../../../testing/provider-conformance.ts';
import {
  createReplayTransport,
  fixedTokens,
  GCP_PROD_TARGET as prodTarget,
  loadFixture,
} from '../../../testing/gcp-replay.ts';
import type { ReleaseArtifact } from '../contract.ts';
import { createGcpProvider } from './index.ts';
import { revisionIdOf } from './targets.ts';

/* Cloud Run against recorded answers: the conformance kit, then the numbers it read. */

const IMAGE = 'asia-south1-docker.pkg.dev/acme-ci/apps/checkout-api';

const release = (version: string, commitSha: string, digit: string): ReleaseArtifact => ({
  id: `00000000-0000-7000-8000-00000000000${digit}`,
  version,
  commitSha,
  imageRepository: IMAGE,
  imageDigests: { 'linux/amd64': `sha256:${digit.repeat(64)}` },
  resolvedConfig: {},
});

const replay = createReplayTransport(loadFixture('cloud-run-rollout'));
const provider = createGcpProvider({
  transport: replay.transport,
  tokensFor: () => fixedTokens(),
  poll: { intervalMs: 0, sleep: async () => {} },
});

describeTargetsConformance('gcp', async () => ({
  provider,
  target: prodTarget,
  stable: release('v1.42.0', 'b7d2e91', '1'),
  next: release('v2.0.0', 'c4e8a10', '2'),
}));

describe('the Cloud Run rollout replay', () => {
  afterAll(() => replay.verify({ allUsed: true }));

  it('acted as the environment deployer for every call', () => {
    expect(replay.calls[0]).toContain('deployer@acme-commerce-prod');
    expect(replay.calls.filter((call) => call.includes('generateAccessToken'))).toHaveLength(1);
  });
});

describe('revision names', () => {
  it('start with the service and stay inside Cloud Run’s limit', () => {
    expect(revisionIdOf('checkout-api', release('v1.42.0', 'b7d2e91aa', '1'))).toBe(
      'checkout-api-v1-42-0-b7d2e91',
    );
    const long = revisionIdOf('a'.repeat(50), release('v1.0.0-rc.1+build.77', 'f'.repeat(40), '1'));
    expect(long.length).toBeLessThanOrEqual(63);
    expect(long).toMatch(/^[a-z0-9-]+[a-z0-9]$/);
  });
});
