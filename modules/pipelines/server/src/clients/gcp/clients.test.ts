import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createReplayTransport, fixedTokens, loadFixture } from '../../testing/gcp-replay.ts';
import { createTokenSource, KeyFileRefusedError } from './auth.ts';
import { createGcpHttp, GcpApiError } from './http.ts';
import { waitForOperation } from './operations.ts';
import { createGcpClients } from './index.ts';
import { withBinding } from './policy.ts';

/* The shared plumbing every Google Cloud client stands on, against recorded answers. */

const URL_A = 'https://run.googleapis.com/v2/projects/p/locations/l/services/s';

describe('the Google Cloud HTTP client', () => {
  it('turns Google’s error envelope into a typed error with its reason', async () => {
    const replay = createReplayTransport([
      {
        method: 'GET',
        url: URL_A,
        status: 403,
        response: {
          error: {
            code: 403,
            message: 'Permission denied on resource project p.',
            status: 'PERMISSION_DENIED',
            details: [{ reason: 'IAM_PERMISSION_DENIED' }],
          },
        },
      },
    ]);
    const http = createGcpHttp({ tokens: fixedTokens(), transport: replay.transport });
    const failure = await http.send({ url: URL_A, schema: z.object({}) }).catch((e) => e);
    expect(failure).toBeInstanceOf(GcpApiError);
    expect(failure).toMatchObject({ status: 403, reason: 'IAM_PERMISSION_DENIED' });
  });

  it('answers null for a 404 when asked whether something exists', async () => {
    const replay = createReplayTransport([
      { method: 'GET', url: URL_A, status: 404, response: {} },
    ]);
    const http = createGcpHttp({ tokens: fixedTokens(), transport: replay.transport });
    expect(await http.find({ url: URL_A, schema: z.object({}) })).toBeNull();
  });

  it('records a request nothing was recorded for, so the test fails', async () => {
    const replay = createReplayTransport([]);
    const http = createGcpHttp({ tokens: fixedTokens(), transport: replay.transport });
    await expect(http.find({ url: URL_A, schema: z.object({}) })).rejects.toThrow();
    expect(() => replay.verify()).toThrow(/no recorded answer/);
  });
});

describe('long-running operations', () => {
  it('give up after the bounded wait', async () => {
    const op = { name: 'operations/slow' };
    const replay = createReplayTransport([
      {
        method: 'GET',
        url: 'https://x.googleapis.com/v1/operations/slow',
        repeat: true,
        response: op,
      },
    ]);
    const http = createGcpHttp({ tokens: fixedTokens(), transport: replay.transport });
    let clock = 0;
    const started = Date.now;
    Date.now = () => clock;
    try {
      const failure = waitForOperation(http, 'https://x.googleapis.com/v1', op, {
        timeoutMs: 10_000,
        intervalMs: 4_000,
        sleep: async (ms) => {
          clock += ms;
        },
      });
      await expect(failure).rejects.toMatchObject({ reason: 'DEADLINE_EXCEEDED' });
    } finally {
      Date.now = started;
    }
  });
});

describe('keyless credentials', () => {
  it('refuses a service account key file', () => {
    expect(() =>
      createTokenSource({
        kind: 'external_account',
        config: { type: 'service_account', private_key: 'redacted' },
      }),
    ).toThrow(KeyFileRefusedError);
  });

  it('trades Bemmoly’s own token for Google’s and acts as the control account', async () => {
    const replay = createReplayTransport(loadFixture('federation'));
    const tokens = createTokenSource(
      {
        kind: 'federated',
        audience:
          '//iam.googleapis.com/projects/771205334188/locations/global/workloadIdentityPools/bemmoly/providers/bemmoly',
        serviceAccount: 'bemmoly-control@acme-bemmoly.iam.gserviceaccount.com',
      },
      {
        transport: replay.transport,
        subjectToken: async () => 'eyJhbGciOiJFUzI1NiJ9.bemmoly-signed.sig',
      },
    );
    const clients = createGcpClients({ tokens, transport: replay.transport });
    expect(await clients.billing.getAccount('01A2B3-C4D5E6-F7A8B9')).toMatchObject({ open: true });
    expect(await tokens.token()).toBe('ya29.control-via-federation');
    replay.verify({ allUsed: true });
  });
});

describe('IAM policies', () => {
  it('add a member once and leave an existing grant alone', () => {
    const policy = { etag: 'e', bindings: [{ role: 'roles/run.developer', members: ['user:a'] }] };
    const added = withBinding(policy, 'roles/run.developer', 'user:b');
    expect(added?.bindings).toEqual([
      { role: 'roles/run.developer', members: ['user:a', 'user:b'] },
    ]);
    expect(withBinding(added ?? policy, 'roles/run.developer', 'user:b')).toBeNull();
  });
});
