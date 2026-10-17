import type { SqlClient } from '@bemmoly/core';
import {
  FAKE_CODE_HOST_TOKEN,
  githubDelivery,
  startFakeCodeHost,
  type FakeCodeHost,
} from '@bemmoly/core/testing';
import type { CodeHost } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness, type SignedInApp } from '../boot-harness.ts';
import { codeLinkCalls } from './code-link-calls.ts';

/*
 * Code host events on the real boot path: with Pipelines enabled, a signed GitHub push
 * reaches Pipelines' event consumer and lands in its durable inbox once, beside Work's links.
 */

const SECRET = 'integration-test-webhook-secret';

describe('code host events reach Pipelines', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let app: SignedInApp;
  let sql: SqlClient;
  let fake: FakeCodeHost;
  let github: CodeHost;
  const { call, deliver } = codeLinkCalls(() => app);

  beforeAll(async () => {
    const started = await startBootHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    app = await harness.boot('', { BEMMOLY_ALLOW_PRIVATE_URLS: 'true' });
    sql = app.instance.database!.sql;
    fake = await startFakeCodeHost();
    const enabled = await call('POST', '/admin/modules/pipelines/enable', {
      access: { mode: 'everyone' },
    });
    expect(enabled.status, JSON.stringify(enabled.body)).toBeLessThan(300);
    const created = await call<CodeHost>('POST', '/admin/code-hosts', {
      kind: 'github',
      name: 'Acme GitHub',
      baseUrl: fake.url,
      webhookSecret: SECRET,
      credentials: { mode: 'token', token: FAKE_CODE_HOST_TOKEN },
      repositories: ['acme/api'],
    });
    github = created.body;
  });

  afterAll(async () => {
    await fake?.close();
    await harness?.stop();
  });

  it('stores a push to the default branch in the inbox, once per delivery', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const delivery = githubDelivery('push.main', SECRET, { deliveryId: 'push-main-1' });
    const first = await deliver(github, delivery);
    expect(first.status).toBeLessThan(300);
    expect(first.body).toMatchObject({ outcome: 'processed' });
    expect((await deliver(github, delivery)).body).toMatchObject({ outcome: 'duplicate' });
    const rows = await sql<
      {
        event: string;
        repository_full_name: string;
        payload: { push: { isDefaultBranch: boolean } };
      }[]
    >`
      select event, repository_full_name, payload from pipeline_webhook_inbox
      where delivery_id = 'push-main-1:0'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event: 'push',
      repository_full_name: 'acme/api',
      payload: { push: { isDefaultBranch: true } },
    });
  });

  it('stores events Work never sees, such as a workflow run', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const response = await deliver(github, githubDelivery('workflow_run.completed', SECRET));
    expect(response.body).toMatchObject({ outcome: 'processed' });
    const [row] = await sql<{ count: number }[]>`
      select count(*)::int from pipeline_webhook_inbox where event = 'workflow_run'`;
    expect(row?.count).toBe(1);
  });
});
