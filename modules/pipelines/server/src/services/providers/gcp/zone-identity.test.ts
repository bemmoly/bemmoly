import { describe, expect, it } from 'vitest';
import {
  createReplayTransport,
  fixedTokens,
  type RecordedExchange,
} from '../../../testing/gcp-replay.ts';
import type { ConnectionRecord, DesiredResource } from '../contract.ts';
import { createGcpProvider } from './index.ts';

/*
 * The narrow grants a landing zone makes: the deployer may act as the runtime account and no
 * other, whichever of the two is made second, and secrets are never granted on the project.
 */

const PROJECT = 'acme-commerce-dev';
const IAM = 'https://iam.googleapis.com/v1';
const RM = 'https://cloudresourcemanager.googleapis.com/v3';
const DEPLOYER = `deployer@${PROJECT}.iam.gserviceaccount.com`;
const RUNTIME = `runtime@${PROJECT}.iam.gserviceaccount.com`;
const CONTROL = 'bemmoly-control@acme-bemmoly.iam.gserviceaccount.com';
const ACT_AS = { role: 'roles/iam.serviceAccountUser', members: [`serviceAccount:${DEPLOYER}`] };

const connection: ConnectionRecord = {
  id: '0199f0aa-0000-7000-8000-000000000009',
  provider: 'gcp',
  name: 'Acme Google Cloud',
  layout: 'per-environment',
  boundaryRef: null,
  config: { organizationId: '583920174411', billingAccountId: '01A2B3-C4D5E6-F7A8B9' },
};

const resource = (kind: string, spec: Record<string, unknown>) =>
  ({ kind, name: kind, account: PROJECT, spec, dependsOn: [] }) as DesiredResource;

const account = (email: string): RecordedExchange => ({
  method: 'GET',
  url: `${IAM}/projects/${PROJECT}/serviceAccounts/${email}`,
  response: { name: `projects/${PROJECT}/serviceAccounts/${email}`, email },
});
const accountPolicy = (email: string, bindings: unknown[], etag = 'A1'): RecordedExchange => ({
  method: 'POST',
  url: `${IAM}/projects/-/serviceAccounts/${email}:getIamPolicy`,
  response: { etag, bindings },
});
const setAccountPolicy = (email: string, bindings: unknown[]): RecordedExchange => ({
  method: 'POST',
  url: `${IAM}/projects/-/serviceAccounts/${email}:setIamPolicy`,
  body: { policy: { bindings } },
  response: { etag: 'A2', bindings },
});
const projectPolicy = (bindings: unknown[]): RecordedExchange => ({
  method: 'POST',
  url: `${RM}/projects/${PROJECT}:getIamPolicy`,
  response: { etag: 'P1', bindings },
});
const tokenInfo: RecordedExchange = {
  method: 'POST',
  url: 'https://oauth2.googleapis.com/tokeninfo',
  response: { email: CONTROL },
  repeat: true,
};

function replaying(exchanges: RecordedExchange[]) {
  const replay = createReplayTransport(exchanges);
  const provider = createGcpProvider({
    transport: replay.transport,
    tokensFor: () => fixedTokens(),
    poll: { intervalMs: 0, sleep: async () => {} },
  });
  if (!provider.landingZone) throw new Error('landing zone missing');
  return { replay, zone: provider.landingZone };
}

const DEPLOY_ROLES = [
  { role: 'roles/run.admin', members: [`serviceAccount:${DEPLOYER}`] },
  { role: 'roles/monitoring.viewer', members: [`serviceAccount:${DEPLOYER}`] },
];
const TOKEN = {
  role: 'roles/iam.serviceAccountTokenCreator',
  members: [`serviceAccount:${CONTROL}`],
};
const RUNTIME_ROLES = [
  'roles/logging.logWriter',
  'roles/monitoring.metricWriter',
  'roles/cloudtrace.agent',
];

describe('who the deployer may act as', () => {
  it('grants Service Account User on the runtime account when it is made after the deployer', async () => {
    const runtimeBindings = RUNTIME_ROLES.map((role) => ({
      role,
      members: [`serviceAccount:${RUNTIME}`],
    }));
    const { replay, zone } = replaying([
      account(RUNTIME),
      projectPolicy(runtimeBindings),
      // The deployer exists, so the runtime account's own apply lets it act as it.
      account(RUNTIME),
      account(DEPLOYER),
      accountPolicy(RUNTIME, []),
      setAccountPolicy(RUNTIME, [ACT_AS]),
      account(RUNTIME),
      projectPolicy(runtimeBindings),
    ]);
    const runtime = resource('runtime_identity', { name: 'runtime', purpose: 'runtime' });
    const observed = await zone.apply(connection, runtime);
    expect(zone.diff(runtime, observed)).toEqual([]);
    replay.verify({ allUsed: true });
  });

  it('reports a deployer that cannot act as the runtime account, and its apply repairs it', async () => {
    // An older zone: Service Account User on the whole project, which no longer counts.
    const older = [...DEPLOY_ROLES, ACT_AS];
    const { replay, zone } = replaying([
      tokenInfo,
      account(DEPLOYER),
      projectPolicy(older),
      accountPolicy(DEPLOYER, [TOKEN]),
      account(RUNTIME),
      accountPolicy(RUNTIME, []),
    ]);
    const deployer = resource('deployer_identity', { name: 'deployer' });
    const seen = await zone.read(connection, deployer);
    expect(zone.diff(deployer, seen ?? {})).toEqual(['actsAsRuntime is false, wanted true']);
    replay.verify({ allUsed: true });

    const repair = replaying([
      tokenInfo,
      account(DEPLOYER),
      projectPolicy(older),
      account(RUNTIME),
      account(DEPLOYER),
      accountPolicy(RUNTIME, []),
      setAccountPolicy(RUNTIME, [ACT_AS]),
      accountPolicy(DEPLOYER, [TOKEN]),
      account(DEPLOYER),
      projectPolicy(older),
      accountPolicy(DEPLOYER, [TOKEN]),
      account(RUNTIME),
      accountPolicy(RUNTIME, [ACT_AS]),
    ]);
    const fixed = await repair.zone.apply(connection, deployer);
    expect(fixed).toEqual({
      name: 'deployer',
      roles: ['roles/monitoring.viewer', 'roles/run.admin'],
      impersonated: true,
      actsAsRuntime: true,
    });
    // The project policy already held the deploy roles, so it was never written.
    expect(repair.replay.calls.some((call) => call.includes(`${PROJECT}:setIamPolicy`))).toBe(
      false,
    );
    repair.replay.verify({ allUsed: true });
  });
});

describe('the secret store', () => {
  it('grants nothing on the project; deploys grant each secret to its reader', async () => {
    const { replay, zone } = replaying([account(RUNTIME)]);
    const store = resource('secret_store', { readers: ['runtime'] });
    const observed = await zone.apply(connection, store);
    expect(observed).toEqual({ readers: ['runtime'] });
    expect(zone.diff(store, observed)).toEqual([]);
    expect(replay.calls.some((call) => call.includes('IamPolicy'))).toBe(false);
    replay.verify({ allUsed: true });
  });
});
