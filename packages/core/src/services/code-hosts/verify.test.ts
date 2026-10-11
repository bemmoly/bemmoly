import { generateKeyPairSync, createVerify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { githubDelivery, gitlabDelivery } from '../../testing/code-host-deliveries.ts';
import { githubAppJwt } from './hosts/github.ts';
import { codeHostDriver } from './registry.ts';
import type { WebhookRequest } from './types.ts';

const SECRET = 'a-webhook-secret-of-some-length';

const asRequest = (delivery: {
  headers: Record<string, string>;
  body: string;
}): WebhookRequest => ({
  headers: delivery.headers,
  body: Buffer.from(delivery.body),
});

describe('GitHub signatures', () => {
  const github = codeHostDriver('github');

  it('accepts a body signed with the webhook secret', () => {
    expect(github.verify(asRequest(githubDelivery('pull_request.opened', SECRET)), SECRET)).toBe(
      true,
    );
  });

  it('refuses a body changed after signing', () => {
    const delivery = githubDelivery('pull_request.opened', SECRET);
    const tampered = { ...delivery, body: delivery.body.replace('"opened"', '"closed"') };
    expect(github.verify(asRequest(tampered), SECRET)).toBe(false);
  });

  it('refuses a signature made with another secret', () => {
    const delivery = githubDelivery('push', 'someone-elses-secret-value');
    expect(github.verify(asRequest(delivery), SECRET)).toBe(false);
  });

  it('refuses a missing, empty or SHA-1 signature', () => {
    const delivery = githubDelivery('push', SECRET);
    const without = { ...delivery.headers };
    delete without['x-hub-signature-256'];
    expect(github.verify(asRequest({ ...delivery, headers: without }), SECRET)).toBe(false);
    const empty = { ...delivery.headers, 'x-hub-signature-256': '' };
    expect(github.verify(asRequest({ ...delivery, headers: empty }), SECRET)).toBe(false);
    const sha1 = { ...delivery.headers, 'x-hub-signature-256': 'sha1=0123456789abcdef' };
    expect(github.verify(asRequest({ ...delivery, headers: sha1 }), SECRET)).toBe(false);
  });

  it('never verifies against an empty secret', () => {
    const delivery = githubDelivery('push', '');
    expect(github.verify(asRequest(delivery), '')).toBe(false);
  });

  it('signs its own test ping so the same check passes', () => {
    expect(github.verify(github.ping(SECRET), SECRET)).toBe(true);
    expect(github.verify(github.ping(SECRET), `${SECRET}x`)).toBe(false);
  });
});

describe('GitLab tokens', () => {
  const gitlab = codeHostDriver('gitlab');

  it('accepts the secret token and refuses any other', () => {
    expect(gitlab.verify(asRequest(gitlabDelivery('push', SECRET)), SECRET)).toBe(true);
    expect(gitlab.verify(asRequest(gitlabDelivery('push', `${SECRET}!`)), SECRET)).toBe(false);
    expect(gitlab.verify(asRequest(gitlabDelivery('push', SECRET.slice(0, 5))), SECRET)).toBe(
      false,
    );
  });

  it('refuses a delivery without the token header', () => {
    const delivery = gitlabDelivery('push', SECRET);
    const headers = { ...delivery.headers };
    delete headers['x-gitlab-token'];
    expect(gitlab.verify(asRequest({ ...delivery, headers }), SECRET)).toBe(false);
  });

  it('builds a test delivery the same check accepts', () => {
    expect(gitlab.verify(gitlab.ping(SECRET), SECRET)).toBe(true);
  });
});

describe('delivery ids', () => {
  it("uses the host's id, so a redelivery has the same one", () => {
    const github = codeHostDriver('github');
    const first = githubDelivery('push', SECRET, {
      deliveryId: 'f0e1d2c3-0000-4000-8000-000000000001',
    });
    expect(github.deliveryId(asRequest(first))).toBe('f0e1d2c3-0000-4000-8000-000000000001');
    const gitlab = codeHostDriver('gitlab');
    const second = gitlabDelivery('push', SECRET, { deliveryId: 'gl-uuid-1' });
    expect(gitlab.deliveryId(asRequest(second))).toBe('gl-uuid-1');
  });

  it('falls back to a digest of the body when the host sends no id', () => {
    const github = codeHostDriver('github');
    const delivery = githubDelivery('push', SECRET);
    const headers = { ...delivery.headers };
    delete headers['x-github-delivery'];
    const id = github.deliveryId(asRequest({ ...delivery, headers }));
    expect(id).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(github.deliveryId(asRequest({ ...delivery, headers }))).toBe(id);
  });
});

describe('GitHub App tokens', () => {
  it('signs an RS256 JWT the app key verifies, issued a minute back', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const jwt = githubAppJwt('123456', pem, 1_800_000_000);
    const [header, claims, signature] = jwt.split('.');
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${claims}`);
    expect(verifier.verify(publicKey, Buffer.from(signature!, 'base64url'))).toBe(true);
    expect(JSON.parse(Buffer.from(claims!, 'base64url').toString())).toEqual({
      iat: 1_800_000_000 - 60,
      exp: 1_800_000_000 + 540,
      iss: '123456',
    });
  });
});
