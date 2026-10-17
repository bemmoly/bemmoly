import { describe, expect, it } from 'vitest';
import {
  createReplayTransport,
  fixedTokens,
  GCP_PROD_TARGET as prodTarget,
  loadFixture,
  type RecordedExchange,
} from '../../../testing/gcp-replay.ts';
import type { ConnectionRecord } from '../contract.ts';
import { createGcpProvider } from './index.ts';

/* The Google Cloud provider's parts against recorded answers; nothing reaches the network. */

const connection: ConnectionRecord = {
  id: '0199f0aa-0000-7000-8000-000000000002',
  provider: 'gcp',
  name: 'Acme Google Cloud',
  layout: 'per-environment',
  boundaryRef: null,
  config: { organizationId: '583920174411', billingAccountId: '01A2B3-C4D5E6-F7A8B9' },
};

function replaying(...fixtures: RecordedExchange[][]) {
  const replay = createReplayTransport(...fixtures);
  const provider = createGcpProvider({
    transport: replay.transport,
    tokensFor: () => fixedTokens(),
    poll: { intervalMs: 0, sleep: async () => {} },
  });
  return { replay, provider };
}

const parts = <T>(part: T | undefined): T => {
  if (!part) throw new Error('part missing');
  return part;
};

describe('the Google Cloud connection check', () => {
  it('names the control identity when it can create folders and link billing', async () => {
    const { replay, provider } = replaying(loadFixture('connection-ok'));
    const check = await parts(provider.connection).verify(connection);
    expect(check).toEqual({
      ok: true,
      principal: 'bemmoly-control@acme-bemmoly.iam.gserviceaccount.com',
      problems: [],
    });
    replay.verify({ allUsed: true });
  });

  it('says what to grant when folder and billing access are missing', async () => {
    const { replay, provider } = replaying(loadFixture('connection-denied'));
    const check = await parts(provider.connection).verify(connection);
    expect(check.ok).toBe(false);
    expect(check.problems).toEqual([
      expect.stringContaining('Folder Creator and Project Creator on organization 583920174411'),
      expect.stringContaining('Billing Account User'),
    ]);
    replay.verify({ allUsed: true });
  });

  it('explains keyless setup when no token can be had', async () => {
    const { replay, provider } = replaying(loadFixture('connection-no-token'));
    const check = await parts(provider.connection).verify(connection);
    expect(check.principal).toBeNull();
    expect(check.problems[0]).toMatch(/workload identity pool/);
    replay.verify();
  });
});

describe('Google Cloud folders and projects', () => {
  it('creates the boundary folder, lists managed projects and creates one with billing', async () => {
    const { replay, provider } = replaying(loadFixture('org'));
    const org = parts(provider.org);
    expect(await org.ensureBoundary(connection, 'Bemmoly')).toEqual({
      ref: 'folders/417302018845',
    });
    const accounts = await org.listAccounts(connection);
    expect(accounts.map((account) => account.externalId)).toEqual(['acme-bemmoly', 'acme-ci']);
    const placed = { ...connection, boundaryRef: 'folders/417302018845' };
    await org.createAccount(placed, {
      externalId: 'acme-dev',
      name: 'Dev',
      labels: { environment: 'dev' },
    });
    replay.verify({ allUsed: true });
  });

  it('counts billing-linked projects against the quota', async () => {
    const { replay, provider } = replaying(loadFixture('org'));
    const org = parts(provider.org);
    expect(await org.checkQuota(connection, 2)).toEqual([]);
    const [problem] = await org.checkQuota(connection, 3);
    expect(problem).toContain('needs 3 new projects');
    expect(problem).toContain('can pay for 2 more (3 of 5 in use)');
    expect(problem).toContain('billing quota increase');
    replay.verify();
  });

  it('refuses to create a project before the folder exists', async () => {
    const { provider } = replaying([]);
    await expect(
      parts(provider.org).createAccount(connection, { externalId: 'x', name: 'x', labels: {} }),
    ).rejects.toThrow(/folder/);
  });
});

describe('the Google Cloud landing zone', () => {
  const resource = (kind: string, spec: Record<string, unknown>) =>
    ({ kind, name: kind, account: 'acme-commerce-dev', spec, dependsOn: [] }) as never;

  it('enables missing APIs, creates the deployer and lets the control identity act as it', async () => {
    const { replay, provider } = replaying(loadFixture('landing-zone'));
    const zone = parts(provider.landingZone);
    const apis = resource('service_api', {
      features: ['containers', 'identity', 'logging', 'metrics'],
    });
    expect(zone.diff(apis, await zone.apply(connection, apis))).toEqual([]);

    const deployer = resource('deployer_identity', { name: 'deployer' });
    const observed = await zone.apply(connection, deployer);
    expect(observed).toEqual({
      name: 'deployer',
      roles: ['roles/iam.serviceAccountUser', 'roles/monitoring.viewer', 'roles/run.developer'],
      impersonated: true,
    });
    expect(zone.diff(deployer, observed)).toEqual([]);

    const pull = resource('registry_access', {
      registryAccount: 'acme-ci',
      repository: 'apps',
      region: 'asia-south1',
      access: 'pull',
      identity: 'runtime',
    });
    const seen = await zone.read(connection, pull);
    expect(zone.diff(pull, seen ?? {})).toEqual(['granted is false, wanted true']);

    const logs = resource('logging', { retentionDays: 90 });
    expect(zone.diff(logs, (await zone.read(connection, logs)) ?? {})).toEqual([
      'retentionDays is 30, wanted 90',
    ]);
    replay.verify({ allUsed: true });
  });
});

describe('Google Cloud registry and secrets', () => {
  it('looks images up by digest and writes secrets without reading them back', async () => {
    const { replay, provider } = replaying(loadFixture('registry-secrets'));
    const registry = parts(provider.registry);
    const repository = 'asia-south1-docker.pkg.dev/acme-ci/apps/checkout-api';
    expect(
      await registry.hasDigest(connection, { repository, digest: `sha256:${'1'.repeat(64)}` }),
    ).toBe(true);
    expect(
      await registry.hasDigest(connection, { repository, digest: `sha256:${'9'.repeat(64)}` }),
    ).toBe(false);

    const secrets = parts(provider.secrets);
    const where = { account: 'acme-commerce-prod', name: 'STRIPE_KEY' };
    expect(await secrets.writeVersion(connection, { ...where, value: 'sk_live_example' })).toEqual({
      version: '1',
    });
    await secrets.grantAccess(connection, {
      ...where,
      principal: 'runtime@acme-commerce-prod.iam.gserviceaccount.com',
    });
    replay.verify({ allUsed: true });
    expect(replay.calls.some((call) => call.includes('versions/') && call.startsWith('GET'))).toBe(
      false,
    );
  });
});

describe('Cloud Monitoring numbers', () => {
  const window = { from: new Date('2026-10-16T21:10:00Z'), to: new Date('2026-10-16T21:15:00Z') };

  it('computes the error rate as 5xx over every answer, per minute and overall', async () => {
    const { provider } = replaying(loadFixture('monitoring'));
    const metric = await parts(provider.metrics).revision(
      prodTarget,
      'checkout-api-v2-0-0-c4e8a10',
      'error_rate',
      window,
    );
    expect(metric?.requests).toBe(300);
    expect(metric?.value).toBeCloseTo(8 / 300, 6);
    expect(metric?.points.map(([, value]) => Number(value.toFixed(4)))).toEqual([0.03, 0.025]);
  });

  it('takes the worst minute’s p95 as the window’s latency', async () => {
    const { provider } = replaying(loadFixture('monitoring'));
    const metric = await parts(provider.metrics).revision(
      prodTarget,
      'checkout-api-v2-0-0-c4e8a10',
      'latency_p95',
      window,
    );
    expect(metric?.value).toBe(340.25);
    expect(metric?.points).toHaveLength(2);
  });

  it('reads the error budget only where an SLO is configured', async () => {
    const { provider } = replaying(loadFixture('monitoring'));
    const metrics = parts(provider.metrics);
    expect(await metrics.errorBudget(prodTarget)).toBeNull();
    const withSlo = {
      ...prodTarget,
      connection: {
        ...prodTarget.connection,
        config: {
          ...prodTarget.connection.config,
          slos: {
            'checkout-api':
              'projects/771205334231/services/checkout-api/serviceLevelObjectives/availability',
          },
        },
      },
    };
    expect(await metrics.errorBudget(withSlo)).toBe(0.71);
  });
});
