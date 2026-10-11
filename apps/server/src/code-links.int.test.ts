import type { SqlClient } from '@bemmoly/core';
import {
  FAKE_CODE_HOST_TOKEN,
  githubDelivery,
  gitlabDelivery,
  startFakeCodeHost,
  type FakeCodeHost,
} from '@bemmoly/core/testing';
import type { CodeHost, CodeHostDelivery } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness, type SignedInApp } from './boot-harness.ts';
import { codeLinkCalls } from './code-hosts/code-link-calls.ts';

/*
 * Code links on the real boot path against real Postgres: a GitHub and a GitLab host
 * connected in Settings, signed deliveries from the hand-written fixtures through the
 * anonymous webhook route, Work's links and moves, redelivery, refusals, the test delivery
 * and a backfill against a local fake API. Nothing reaches a real code host.
 */

const SECRET = 'integration-test-webhook-secret';
const KEYS = { 'ACME-1': 'DEV-1', 'ACME-2': 'DEV-2' };

describe('code links', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let app: SignedInApp;
  let sql: SqlClient;
  let fake: FakeCodeHost;
  let github: CodeHost;
  let gitlab: CodeHost;
  const { call, deliver, links, statusOf, seedProject } = codeLinkCalls(() => app);

  beforeAll(async () => {
    const started = await startBootHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    app = await harness.boot('', { BEMMOLY_ALLOW_PRIVATE_URLS: 'true' });
    sql = app.instance.database!.sql;
    fake = await startFakeCodeHost({ replace: KEYS });
    await seedProject();
  });

  afterAll(async () => {
    await fake?.close();
    await harness?.stop();
  });

  it('connects GitHub and keeps the secrets write-only and sealed', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const created = await call<CodeHost>('POST', '/admin/code-hosts', {
      kind: 'github',
      name: 'Acme GitHub',
      baseUrl: fake.url,
      webhookSecret: SECRET,
      credentials: { mode: 'token', token: FAKE_CODE_HOST_TOKEN },
      repositories: ['acme/api'],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    github = created.body;
    expect(github).toMatchObject({
      hasCredentials: true,
      hasWebhookSecret: true,
      authMode: 'token',
    });
    expect(github.webhookUrl).toBe(`http://localhost:8080/api/v1/code-hosts/${github.id}/webhooks`);
    expect(JSON.stringify(github)).not.toContain(FAKE_CODE_HOST_TOKEN);
    expect(JSON.stringify(github)).not.toContain(SECRET);
    const [row] = await sql<{ secrets_encrypted: string }[]>`
      select secrets_encrypted from integrations where id = ${github.id}`;
    expect(row!.secrets_encrypted).not.toContain(FAKE_CODE_HOST_TOKEN);
    expect(row!.secrets_encrypted).not.toContain(SECRET);
  });

  it('refuses a GitLab host that asks to connect as an app', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const refused = await call('POST', '/admin/code-hosts', {
      kind: 'gitlab',
      name: 'Nope',
      webhookSecret: SECRET,
      credentials: { mode: 'app', appId: '1', installationId: '2' },
    });
    expect(refused.status).toBe(400);
  });

  it('links an opened pull request to the issue its branch and body name', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const received = await deliver(
      github,
      githubDelivery('pull_request.opened', SECRET, { replace: KEYS }),
    );
    expect(received).toEqual({ status: 200, body: { outcome: 'processed' } });
    expect(await links('DEV-1')).toEqual([
      expect.objectContaining({ kind: 'pull_request', ref: '#4821', state: 'open' }),
    ]);
    expect(await links('DEV-2')).toEqual([]);
  });

  it('answers a redelivery as a duplicate and writes nothing twice', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const deliveryId = '7b1c2d3e-0000-4000-8000-00000000c0de';
    const first = githubDelivery('pull_request_review.submitted', SECRET, {
      replace: KEYS,
      deliveryId,
    });
    expect((await deliver(github, first)).body).toEqual({ outcome: 'processed' });
    const again = await deliver(github, first);
    expect(again).toEqual({ status: 200, body: { outcome: 'duplicate' } });
    const [count] = await sql<{ links: number; deliveries: number }[]>`
      select (select count(*)::int from code_links) as links,
        (select count(*)::int from integration_deliveries where delivery_id = ${deliveryId})
          as deliveries`;
    expect(count).toEqual({ links: 1, deliveries: 1 });
    expect((await links('DEV-1'))[0]).toMatchObject({ review: 'approved' });
  });

  it('refuses a bad signature before reading the body, and says so in Settings', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const forged = githubDelivery('pull_request.merged', 'not-the-secret-at-all', {
      replace: KEYS,
    });
    const refused = await deliver(github, forged);
    expect(refused.status).toBe(401);
    const unsigned = githubDelivery('pull_request.merged', SECRET, { replace: KEYS });
    delete unsigned.headers['x-hub-signature-256'];
    expect((await deliver(github, unsigned)).status).toBe(401);
    expect((await links('DEV-1'))[0]?.state).toBe('open');
    const host = (await call<CodeHost>('GET', `/admin/code-hosts/${github.id}`)).body;
    expect(host.lastError).toMatch(/signature did not match/);
    const garbage = await deliver(github, { headers: forged.headers, body: 'x'.repeat(10) });
    expect(garbage.status).toBe(401);
  });

  it('moves the issue as the project asks, within the workflow', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const statuses = new Map(
      (
        await sql<{ id: string; name: string }[]>`
          select s.id, s.name from workflow_statuses s
          where s.workflow_id = (
            select w.id from workflows w join projects p on p.key = 'DEV'
            where w.project_id = p.id or w.project_id is null
            order by w.project_id nulls last, w.id limit 1)`
      ).map((row) => [row.name, row.id]),
    );
    const id = (name: string) => statuses.get(name)!;
    for (const name of ['Selected', 'In progress']) {
      const moved = await call('PATCH', '/work/issues/DEV-2', { statusId: id(name) });
      expect(moved.status, JSON.stringify(moved.body)).toBe(200);
    }
    const saved = await call('PUT', '/work/projects/DEV/code-transitions', {
      pullRequestOpened: id('Code review'),
      pullRequestMerged: id('Done'),
    });
    expect(saved.body).toEqual({
      pullRequestOpened: id('Code review'),
      pullRequestMerged: id('Done'),
    });

    const host = await call<CodeHost>('POST', '/admin/code-hosts', {
      kind: 'gitlab',
      name: 'Acme GitLab',
      baseUrl: fake.url,
      webhookSecret: SECRET,
      credentials: { mode: 'token', token: FAKE_CODE_HOST_TOKEN },
      repositories: ['acme/platform/web'],
    });
    expect(host.status, JSON.stringify(host.body)).toBe(201);
    gitlab = host.body;

    // A draft moves nothing; marked ready (opened) it moves the issue to Code review.
    const draft = await deliver(
      gitlab,
      gitlabDelivery('merge_request.open', SECRET, { replace: KEYS }),
    );
    expect(draft.body).toEqual({ outcome: 'processed' });
    expect(await statusOf('DEV-2')).toBe(id('In progress'));
    await deliver(gitlab, gitlabDelivery('merge_request.approved', SECRET, { replace: KEYS }));
    expect(await statusOf('DEV-2')).toBe(id('Code review'));
    await deliver(gitlab, gitlabDelivery('pipeline.failed', SECRET, { replace: KEYS }));
    expect((await links('DEV-2'))[0]).toMatchObject({ checks: 'failing', review: 'approved' });

    // The default workflow has no step from Code review to Done: the issue stays, and the
    // delivery log says why instead of the host retrying forever.
    const merged = await deliver(
      gitlab,
      gitlabDelivery('merge_request.merge', SECRET, { replace: KEYS }),
    );
    expect(merged.body).toEqual({ outcome: 'processed' });
    expect(await statusOf('DEV-2')).toBe(id('Code review'));
    expect((await links('DEV-2'))[0]).toMatchObject({ ref: '!57', state: 'merged' });
    const log = (
      await call<{ items: CodeHostDelivery[] }>('GET', `/admin/code-hosts/${gitlab.id}/deliveries`)
    ).body.items;
    expect(log[0]?.summary).toMatch(/DEV-2 stayed put when its pull request merged/);

    // With a step to Done in the workflow's place (Testing), the merge moves it.
    await call('PUT', '/work/projects/DEV/code-transitions', { pullRequestMerged: id('Testing') });
    await sql`update code_links set state = 'open' where ref = '!57'`;
    const again = gitlabDelivery('merge_request.merge', SECRET, { replace: KEYS });
    await deliver(gitlab, again);
    expect(await statusOf('DEV-2')).toBe(id('Testing'));

    const wrong = gitlabDelivery('merge_request.merge', `${SECRET}-wrong`, { replace: KEYS });
    expect((await deliver(gitlab, wrong)).status).toBe(401);
  });

  it('links commits and branches from a push, and drops a deleted branch', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    await deliver(github, githubDelivery('push', SECRET, { replace: KEYS }));
    expect((await links('DEV-2')).map((link) => [link.kind, link.ref])).toEqual(
      expect.arrayContaining([['commit', 'a1b2c3d']]),
    );
    await deliver(github, githubDelivery('create.branch', SECRET, { replace: KEYS }));
    expect((await links('DEV-1')).map((link) => link.kind)).toContain('branch');
    await deliver(github, githubDelivery('delete.branch', SECRET, { replace: KEYS }));
    expect((await links('DEV-1')).map((link) => link.kind)).not.toContain('branch');
    await deliver(github, githubDelivery('check_suite.completed', SECRET, { replace: KEYS }));
    expect((await links('DEV-1'))[0]).toMatchObject({ kind: 'pull_request', checks: 'passing' });
  });

  it('sends a test delivery through the webhook path and checks the token', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const tested = await call('POST', `/admin/code-hosts/${github.id}/tests`, {});
    expect(tested.status).toBe(201);
    expect(tested.body).toEqual({
      webhook: { ok: true, message: 'A signed test delivery was verified and recorded' },
      api: { ok: true, message: 'Connected as bemmoly-bot' },
    });
    const deliveries = (
      await call<{ items: CodeHostDelivery[] }>('GET', `/admin/code-hosts/${github.id}/deliveries`)
    ).body.items;
    expect(deliveries[0]).toMatchObject({ event: 'ping', outcome: 'test' });
    expect(deliveries.map((d) => d.outcome)).not.toContain('failed');
  });

  it('backfills recent requests through a rate limit, without duplicating links', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const limited = await startFakeCodeHost({
      replace: { 'ACME-1': 'DEV-2' },
      rateLimitOnce: new Set(['/api/v3/repos/acme/api/pulls']),
    });
    try {
      await call('PATCH', `/admin/code-hosts/${github.id}`, { baseUrl: limited.url });
      const queued = await call('POST', `/admin/code-hosts/${github.id}/backfills`, {});
      expect(queued).toEqual({ status: 202, body: { queued: true, repositories: 1 } });
      // The queue runs it: the first page answers as a spent rate limit, the client waits.
      await expect
        .poll(
          async () => {
            const log = (
              await call<{ items: CodeHostDelivery[] }>(
                'GET',
                `/admin/code-hosts/${github.id}/deliveries`,
              )
            ).body.items;
            return log.find((d) => d.event === 'backfill')?.summary ?? '';
          },
          { timeout: 30_000, interval: 250 },
        )
        .toMatch(/^Backfill read 1 request from acme\/api · 1 link updated/);
      // Run again by hand: the same rows, nothing new.
      await app.instance.codeHosts!.backfill(github.id, 'run-again');
      expect(limited.requests.filter((r) => r.endsWith('/pulls'))).toHaveLength(3);
      const prs = (await links('DEV-2')).filter((link) => link.kind === 'pull_request');
      expect(prs.map((link) => link.ref).sort()).toEqual(['!57', '#4821']);
    } finally {
      await limited.close();
    }
  });

  it('removes a host with its links and deliveries', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    expect((await call('DELETE', `/admin/code-hosts/${gitlab.id}`)).status).toBe(204);
    expect((await links('DEV-2')).some((link) => link.ref === '!57')).toBe(false);
    const gone = await deliver(gitlab, gitlabDelivery('push', SECRET, { replace: KEYS }));
    expect(gone.status).toBe(404);
  });
});
