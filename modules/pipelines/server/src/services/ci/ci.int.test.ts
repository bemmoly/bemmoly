import { generateKeyPairSync, sign } from 'node:crypto';
import type { CodeEventOf } from '@bemmoly/core';
import { ConflictError, ForbiddenError, UnauthenticatedError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { releaseSchema } from '../../../../shared/releases.ts';
import type { Jwk } from '../../clients/oidc/discovery.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import { createCiService, type CiService } from './index.ts';

const ISSUER = 'https://token.actions.githubusercontent.com';
const AUDIENCE = 'https://bemmoly.acme.dev';
const SHA = 'e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8';
const DIGEST = `sha256:${'a'.repeat(64)}`;
const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** A GitHub Actions OIDC token, signed with the test's key in place of GitHub's. */
function actionsToken(ref: string, aud = AUDIENCE): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', kid: 'gh-1', typ: 'JWT' });
  const body = b64({
    iss: ISSUER,
    aud,
    exp: now + 300,
    iat: now,
    sub: `repo:acme/checkout:ref:${ref}`,
    repository: 'acme/checkout',
    ref,
    workflow_ref: `acme/checkout/.github/workflows/build.yml@${ref}`,
    sha: SHA,
  });
  const signature = sign('sha256', Buffer.from(`${head}.${body}`), keyPair.privateKey);
  return `${head}.${body}.${signature.toString('base64url')}`;
}

const release = (version: string, image = DIGEST) => ({
  application: 'checkout-api',
  version,
  commitSha: SHA,
  ref: 'refs/heads/main',
  image,
  tests: {
    total: 10,
    passed: 9,
    failed: 1,
    skipped: 0,
    failures: [{ file: 'a.test.ts', name: 'pays', message: 'boom' }],
  },
  externalUrl: 'https://github.com/acme/checkout/actions/runs/1',
});

describe('Bring your CI', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let ci: CiService;
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
    http = await startPipelinesHttp(harness);
    const jwk = { ...(keyPair.publicKey.export({ format: 'jwk' }) as Jwk), kid: 'gh-1' };
    ci = createCiService({
      database: harness.sql,
      access: harness.services.access,
      keys: { keys: async () => [jwk] },
      audiences: [AUDIENCE],
    });
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  const admin = () => harness?.users.admin ?? '';

  it('registers a release from GitHub Actions through a trust rule, once', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const rule = await http.send('POST', '/ci/trust-rules', admin(), {
      issuer: 'github-actions',
      repository: 'acme/checkout',
      refs: ['main'],
    });
    expect(rule.statusCode).toBe(201);
    const principal = await ci.principal(actionsToken('refs/heads/main'));
    const body = release('v2.0.0') as never;
    const first = await ci.register({ ctx: null, principal, body });
    expect(first.created).toBe(true);
    expect(releaseSchema.parse(first.release)).toMatchObject({
      version: 'v2.0.0',
      source: 'external',
      testSummary: { failed: 1 },
    });
    const again = await ci.register({ ctx: null, principal, body });
    expect(again).toMatchObject({ created: false, release: { id: first.release.id } });
    await expect(
      ci.register({
        ctx: null,
        principal,
        body: release('v2.0.0', `sha256:${'b'.repeat(64)}`) as never,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('refuses a token minted for another service', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const elsewhere = actionsToken('refs/heads/main', 'http://other.example');
    await expect(ci.principal(elsewhere)).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('refuses a branch the rule does not allow, and stores the decision', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const principal = await ci.principal(actionsToken('refs/heads/feature/x'));
    const error = await ci
      .register({ ctx: null, principal, body: release('v2.0.1') as never })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect((error as Error).message).toBe(
      'GitHub Actions may not register releases for checkout-api: ref refs/heads/feature/x is not one of main.',
    );
    const [row] = await harness.sql<{ allowed: boolean; actor_kind: string }[]>`
      select allowed, actor_kind from pipeline_decisions where actor_kind = 'ci_oidc'
      order by created_at desc limit 1`;
    expect(row).toEqual({ allowed: false, actor_kind: 'ci_oidc' });
  });

  it('takes a scoped CI token over HTTP, only for its applications', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const created = await http.send('POST', '/ci/tokens', admin(), {
      name: 'Jenkins',
      applications: ['checkout-api'],
    });
    expect(created.statusCode).toBe(201);
    const { token } = created.json() as { token: string };
    expect(token.startsWith('bpci_')).toBe(true);
    const post = (body: object) =>
      http.app.inject({
        method: 'POST',
        url: '/api/v1/pipelines/releases',
        headers: { authorization: `Bearer ${token}` },
        payload: body,
      });
    expect((await post(release('v3.0.0'))).statusCode).toBe(201);
    const other = await post({ ...release('v1.0.0'), application: 'pricing-svc' });
    expect(other.statusCode).toBe(403);
    const list = await http.get('/ci/tokens', admin());
    expect(list.json().items[0]).toMatchObject({ name: 'Jenkins', lastUsedAt: expect.any(String) });
  });

  it("lets the owning team register from a person's session", async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await http.send('POST', '/releases', harness.users.member, release('v4.0.0'));
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      version: 'v4.0.0',
      application: { key: 'checkout-api' },
    });
  });

  it('keeps check and workflow runs per commit for gates', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const base = {
      repository: 'acme/checkout',
      integrationId: 'i-1',
      hostKind: 'github' as const,
      headSha: SHA,
    };
    const events: CodeEventOf[] = [
      {
        ...base,
        deliveryId: 'c-1',
        type: 'workflow_run',
        runId: '1',
        name: 'Security',
        path: '.github/workflows/security.yml',
        headBranch: 'main',
        event: 'push',
        status: 'completed',
        conclusion: 'failure',
        url: null,
        occurredAt: '2026-10-17T05:00:00Z',
      },
      {
        ...base,
        deliveryId: 'c-2',
        type: 'check_run',
        name: 'lint',
        status: 'completed',
        conclusion: 'success',
        url: null,
        app: 'github-actions',
        occurredAt: '2026-10-17T05:01:00Z',
      },
    ];
    await harness.services.inbox.ingest(events);
    const system = {
      ...harness.as(admin()),
      actor: { kind: 'system' as const, id: 'pipelines.inbox' },
    };
    await harness.services.inbox.drain('acme/checkout', system);
    const response = await http.get('/ci/checks', admin(), {
      application: 'checkout-api',
      commit: SHA.slice(0, 12),
    });
    expect(response.json().items).toEqual([
      expect.objectContaining({ kind: 'check_run', name: 'lint', verdict: 'pass' }),
      expect.objectContaining({ kind: 'workflow_run', name: 'security.yml', verdict: 'fail' }),
    ]);
  });
});
