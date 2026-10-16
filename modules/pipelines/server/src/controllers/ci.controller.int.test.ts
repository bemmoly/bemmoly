import { generateKeyPairSync, sign } from 'node:crypto';
import { UnauthenticatedError } from '@bemmoly/shared';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Jwk } from '../clients/oidc/discovery.ts';
import { createCiService } from '../services/ci/index.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../testing/harness.ts';
import { createCiController } from './ci.controller.ts';

const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** A GitHub Actions token any repository could mint for another service's audience. */
function tokenFor(aud: string): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', kid: 'gh-1', typ: 'JWT' });
  const body = b64({
    iss: 'https://token.actions.githubusercontent.com',
    aud,
    exp: now + 300,
    sub: 'repo:acme/checkout:ref:refs/heads/main',
    repository: 'acme/checkout',
    ref: 'refs/heads/main',
  });
  const signature = sign('sha256', Buffer.from(`${head}.${body}`), keyPair.privateKey);
  return `${head}.${body}.${signature.toString('base64url')}`;
}

describe('POST /releases audience', () => {
  let harness: PipelinesHarness | undefined;
  let reason = '';
  const app = Fastify();

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    const jwk = { ...(keyPair.publicKey.export({ format: 'jwk' }) as Jwk), kid: 'gh-1' };
    const controller = createCiController(
      createCiService({
        database: harness.sql,
        access: harness.services.access,
        keys: { keys: async () => [jwk] },
        audiences: ['https://bemmoly.acme.dev'],
      }),
    );
    app.post('/releases', (request, reply) => controller.registerRelease(request, reply));
    app.setErrorHandler((error, _request, reply) =>
      reply
        .code(error instanceof UnauthenticatedError ? 401 : 500)
        .send({ message: (error as Error).message }),
    );
  });

  afterAll(async () => {
    await app.close();
    await harness?.stop();
  });

  it('refuses a token for another service even when the Host header names it', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await app.inject({
      method: 'POST',
      url: '/releases',
      headers: {
        host: 'other.example',
        authorization: `Bearer ${tokenFor('http://other.example')}`,
      },
      payload: {
        application: 'checkout-api',
        version: 'v9.0.0',
        commitSha: 'abcdef1',
        image: `sha256:${'a'.repeat(64)}`,
      },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json<{ message: string }>().message).toContain('not this server');
  });
});
