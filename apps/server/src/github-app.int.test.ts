import type { SqlClient } from '@bemmoly/core';
import { FAKE_GITHUB_APP, startFakeCodeHost, type FakeCodeHost } from '@bemmoly/core/testing';
import type { CodeHost, GithubAppCreated, GithubAppStart } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness, type SignedInApp } from './boot-harness.ts';
import { codeLinkCalls } from './code-hosts/code-link-calls.ts';

/*
 * Connecting GitHub in one click on the real boot path against real Postgres: the manifest,
 * the handoff page that posts it to GitHub, GitHub's code traded for the app's credentials,
 * and the installation that names the repositories, all against a local fake GitHub
 * Enterprise Server. Nothing reaches a real code host.
 */

describe('GitHub App from a manifest', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let app: SignedInApp;
  let sql: SqlClient;
  let fake: FakeCodeHost;
  let state = '';
  let host: CodeHost;
  const { call } = codeLinkCalls(() => app);

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
  });

  afterAll(async () => {
    await fake?.close();
    await harness?.stop();
  });

  it('starts with a handoff page that posts the manifest to GitHub, and nowhere else', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const started = await call<GithubAppStart>('POST', '/admin/code-hosts/github-app-manifests', {
      name: 'GitHub',
      baseUrl: fake.url,
      organization: 'acme',
    });
    expect(started.status, JSON.stringify(started.body)).toBe(201);
    // The harness's address is localhost; Enterprise Server shares no network with loopback.
    expect(started.body.webhooks).toBe(false);
    const formUrl = new URL(started.body.formUrl);
    state = formUrl.searchParams.get('state') ?? '';
    expect(state).not.toBe('');

    const page = await app.inject({ method: 'GET', url: `${formUrl.pathname}${formUrl.search}` });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toMatch(/text\/html/);
    const csp = String(page.headers['content-security-policy']);
    expect(csp).toContain(`form-action ${fake.url}`);
    expect(csp).toContain("script-src 'sha256-");
    expect(page.body).toContain(`action="${fake.url}/organizations/acme/settings/apps/new?state=`);
    expect(page.body).toContain('name="manifest"');
    expect(page.body).toContain(
      '&#34;redirect_url&#34;:&#34;http://localhost:8080/settings/code-hosts&#34;',
    );
    expect(page.body).not.toContain('hook_attributes');

    const anonymous = await app.instance.app.inject({
      method: 'GET',
      url: `${formUrl.pathname}${formUrl.search}`,
    });
    expect(anonymous.statusCode).toBe(401);
  });

  it('refuses a state it did not seal', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const refused = await call('POST', '/admin/code-hosts/github-apps', {
      code: FAKE_GITHUB_APP.code,
      state: `${state.slice(0, -4)}AAAA`,
    });
    expect(refused.status).toBe(400);
  });

  it("trades GitHub's code for the app and stores its secrets sealed", async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const created = await call<GithubAppCreated>('POST', '/admin/code-hosts/github-apps', {
      code: FAKE_GITHUB_APP.code,
      state,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    host = created.body.host;
    const installUrl = `${fake.url}/github-apps/${FAKE_GITHUB_APP.slug}/installations/new`;
    expect(created.body.installUrl).toBe(installUrl);
    expect(host).toMatchObject({
      kind: 'github',
      baseUrl: fake.url,
      authMode: 'app',
      appId: String(FAKE_GITHUB_APP.id),
      installationId: null,
      installUrl,
      hasCredentials: true,
      hasWebhookSecret: true,
      repositories: [],
    });
    const [row] = await sql<{ secrets_encrypted: string }[]>`
      select secrets_encrypted from integrations where id = ${host.id}`;
    expect(row!.secrets_encrypted).not.toContain('PRIVATE KEY');
    expect(row!.secrets_encrypted).not.toContain(FAKE_GITHUB_APP.webhookSecret);

    // Reloading the return page answers with the stored app; the spent code is not sent again.
    const conversions = fake.requests.filter((line) => line.includes('app-manifests')).length;
    const again = await call<GithubAppCreated>('POST', '/admin/code-hosts/github-apps', {
      code: FAKE_GITHUB_APP.code,
      state,
    });
    expect(again.status).toBe(201);
    expect(again.body.host.id).toBe(host.id);
    expect(fake.requests.filter((line) => line.includes('app-manifests'))).toHaveLength(
      conversions,
    );
  });

  it('refuses an installation that is not of this app', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const refused = await call('POST', `/admin/code-hosts/${host.id}/installations`, {
      installationId: '999',
    });
    expect(refused.status).toBe(400);
  });

  it('reads the installed repositories and starts the backfill', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const installed = await call<CodeHost>('POST', `/admin/code-hosts/${host.id}/installations`, {
      installationId: FAKE_GITHUB_APP.installationId,
    });
    expect(installed.status, JSON.stringify(installed.body)).toBe(201);
    expect(installed.body).toMatchObject({
      installationId: FAKE_GITHUB_APP.installationId,
      repositories: ['acme/api'],
    });
    const tested = await call<{ api: { ok: boolean; message: string } }>(
      'POST',
      `/admin/code-hosts/${host.id}/tests`,
    );
    expect(tested.body.api).toEqual({ ok: true, message: 'Connected as the Bemmoly test app' });
  });

  it('keeps the slug through a rename and drops it when the app is replaced', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const renamed = await call<CodeHost>('PATCH', `/admin/code-hosts/${host.id}`, {
      name: 'Acme GitHub',
    });
    expect(renamed.body.installUrl).not.toBeNull();
    const replaced = await call<CodeHost>('PATCH', `/admin/code-hosts/${host.id}`, {
      credentials: { mode: 'token', token: 'a-hand-made-token-0001' },
    });
    expect(replaced.body.installUrl).toBeNull();
  });
});
