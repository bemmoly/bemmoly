import { describe, expect, it } from 'vitest';
import { SECRETS_PERMISSIONS } from '../../../../../shared/grant-command.ts';
import {
  createReplayTransport,
  fixedTokens,
  type RecordedExchange,
} from '../../../testing/gcp-replay.ts';
import type { ConnectionRecord } from '../contract.ts';
import { createGcpProvider } from './index.ts';

/*
 * The attach check asks for each grant on the resource the grant command puts it on: actAs on
 * the one account services run as, Cloud Run Admin on the project for public services.
 */

const RM = 'https://cloudresourcemanager.googleapis.com/v3';
const SU = 'https://serviceusage.googleapis.com/v1';
const IAM = 'https://iam.googleapis.com/v1';
const PROJECT = 'nila-shop-prod';
const NAMED = `storefront@${PROJECT}.iam.gserviceaccount.com`;

const connection: ConnectionRecord = {
  id: '0199f0aa-0000-7000-8000-0000000000a2',
  provider: 'gcp',
  name: 'Nila Google Cloud',
  layout: 'per-environment',
  boundaryRef: null,
  config: { mode: 'attached', region: 'europe-west1', credentials: { kind: 'metadata' } },
};

const DEPLOY = [
  'run.services.get',
  'run.services.create',
  'run.services.update',
  'run.revisions.get',
  'run.revisions.delete',
];

function check(held: string[], actAs: RecordedExchange, config: Record<string, unknown> = {}) {
  const replay = createReplayTransport([
    // A sign-in with no email behind it, so problems name "Bemmoly".
    { method: 'POST', url: 'https://oauth2.googleapis.com/tokeninfo', response: {}, repeat: true },
    {
      method: 'GET',
      url: `${RM}/projects/${PROJECT}`,
      response: {
        name: 'projects/829301',
        projectId: PROJECT,
        displayName: 'Nila',
        state: 'ACTIVE',
      },
    },
    {
      method: 'GET',
      url: `${SU}/projects/${PROJECT}/services`,
      response: {
        services: ['run', 'monitoring', 'cloudbuild', 'secretmanager'].map((api) => ({
          name: `projects/1/services/${api}.googleapis.com`,
          config: { name: `${api}.googleapis.com` },
        })),
      },
    },
    {
      method: 'POST',
      url: `${RM}/projects/${PROJECT}:testIamPermissions`,
      response: { permissions: held },
    },
    actAs,
  ]);
  const provider = createGcpProvider({
    transport: replay.transport,
    tokensFor: () => fixedTokens(),
    poll: { intervalMs: 0, sleep: async () => {} },
  });
  return {
    replay,
    result: provider.connection!.verifyAccount!(connection, { externalId: PROJECT, config }),
  };
}

const allButPublic = [
  ...DEPLOY,
  'monitoring.timeSeries.list',
  'cloudbuild.builds.create',
  'cloudbuild.builds.get',
  ...SECRETS_PERMISSIONS,
];

describe('the narrowed attach check', () => {
  it('asks the named runtime account, not the project, whether Bemmoly may act as it', async () => {
    const { replay, result } = check(
      allButPublic,
      {
        method: 'POST',
        url: `${IAM}/projects/-/serviceAccounts/${NAMED}:testIamPermissions`,
        response: { permissions: ['iam.serviceAccounts.actAs'] },
      },
      { runtimeServiceAccount: NAMED },
    );
    const answer = await result;
    // Cloud Run Developer deploys; only a public service needs Admin, so it does not fail.
    expect(answer.ok).toBe(true);
    expect(answer.problems).toEqual([
      `Grant Bemmoly Cloud Run Admin on ${PROJECT} so services marked public can be reached; Cloud Run Developer cannot open a service to everyone`,
    ]);
    replay.verify({ allUsed: true });
  });

  it('fails, naming the account, when the runtime account does not exist', async () => {
    const { replay, result } = check([...allButPublic, 'run.services.setIamPolicy'], {
      method: 'POST',
      url: `${IAM}/projects/-/serviceAccounts/829301-compute@developer.gserviceaccount.com:testIamPermissions`,
      status: 404,
      response: { error: { code: 404, message: 'Unknown service account', status: 'NOT_FOUND' } },
    });
    const answer = await result;
    expect(answer.ok).toBe(false);
    expect(answer.problems).toEqual([
      `829301-compute@developer.gserviceaccount.com, the account services in ${PROJECT} run as, does not exist. Name the runtime account when you attach ${PROJECT}, or create it`,
    ]);
    replay.verify({ allUsed: true });
  });
});
