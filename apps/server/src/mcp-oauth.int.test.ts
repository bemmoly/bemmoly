import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DESK_CLIENT,
  DESK_REDIRECT,
  fetched,
  MemoryOAuthProvider,
  oauthSteps,
  startOAuthRun,
  type OAuthRun,
} from './mcp-oauth-harness.ts';

/*
 * MCP client sign-in through the official SDK client's OAuth support against the real host:
 * discovery from the 401, a client ID metadata document, the consent decision from the
 * signed-in session, PKCE, tokens bound to the MCP address, rotation and revocation.
 */

/** Inside this stream's assigned range. */
const PORT = 3541;

describe('mcp oauth', () => {
  let run: OAuthRun | undefined;
  let skipReason = '';
  let steps: ReturnType<typeof oauthSteps>;
  let base = '';

  beforeAll(async () => {
    const started = await startOAuthRun(PORT);
    if (!started.run) {
      skipReason = started.reason;
      return;
    }
    run = started.run;
    steps = oauthSteps(run);
    base = run.base;
  });

  afterAll(async () => run?.harness.stop());

  const sql = () => run!.app.instance.database!.sql;

  it('publishes the metadata a client discovers from the 401', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    const anonymous = await fetch(`${base}/mcp/work`, { method: 'POST', body: '{}' });
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get('www-authenticate')).toBe(
      `Bearer realm="bemmoly", resource_metadata="${base}/.well-known/oauth-protected-resource/mcp/work", scope="mcp:read mcp:write"`,
    );
    const resource = await (
      await fetch(`${base}/.well-known/oauth-protected-resource/mcp/work`)
    ).json();
    expect(resource).toMatchObject({ resource: `${base}/mcp/work`, authorization_servers: [base] });
    const server = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
    expect(server).toMatchObject({
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      code_challenge_methods_supported: ['S256'],
      client_id_metadata_document_supported: true,
      token_endpoint_auth_methods_supported: ['none'],
    });
    expect(server.registration_endpoint).toBeUndefined();
  });

  it('signs a client in through consent, with only what the person chose', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    const provider = new MemoryOAuthProvider(DESK_CLIENT, DESK_REDIRECT);
    const { preview, redirect, url } = await steps.signIn(provider, '', {
      access: 'read',
      modules: ['work'],
    });
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('resource')).toBe(`${base}/mcp`);
    expect(preview).toMatchObject({
      status: 'ready',
      client: {
        id: DESK_CLIENT,
        name: 'Desk Assistant',
        host: 'desk.example',
        redirectHost: 'localhost:7123',
        loopback: true,
      },
      access: 'write',
      requestedModules: null,
    });
    expect(preview.moduleOptions.map((option: { id: string }) => option.id).sort()).toEqual([
      'docs',
      'work',
    ]);
    expect(redirect.searchParams.get('state')).toBe('state-123');
    expect(redirect.searchParams.get('iss')).toBe(base);
    expect(provider.saved).toMatchObject({ token_type: 'Bearer', scope: 'mcp:read module:work' });
    expect(provider.saved!.access_token).toMatch(/^bmo_at_/);
    expect(provider.saved!.refresh_token).toMatch(/^bmo_rt_/);

    const client = await steps.connect(provider);
    try {
      const names = (await client.listTools()).tools.map((tool) => tool.name);
      expect(names).toContain('work.get_issue');
      expect(names).not.toContain('work.set_priority');
      expect(names.some((name) => name.startsWith('docs.'))).toBe(false);
      const issue = await client.callTool({ name: 'work.get_issue', arguments: { key: 'PLT-1' } });
      expect(issue.isError).toBeFalsy();
    } finally {
      await client.close();
    }
    const stored = await sql()`SELECT token_hash FROM oauth_tokens`;
    expect(JSON.stringify(stored)).not.toContain(provider.saved!.access_token);
    const audit = await sql()`
      SELECT action FROM audit_log WHERE action LIKE 'oauth.%' ORDER BY id`;
    expect(audit.map((row) => row['action'])).toEqual([
      'oauth.authorization_approved',
      'oauth.grant_created',
    ]);
    // The document is fetched once and then read from the cache.
    expect(fetched.filter((entry) => entry === DESK_CLIENT)).toHaveLength(1);
  });

  it('binds a token to the MCP address it was issued for', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    const provider = new MemoryOAuthProvider(DESK_CLIENT, DESK_REDIRECT);
    await steps.signIn(provider, '/work');
    const token = provider.saved!.access_token;
    expect((await steps.listTools('/work', token)).status).toBe(200);
    for (const path of ['', '/docs']) {
      const refused = await steps.listTools(path, token);
      expect(refused.status).toBe(401);
      expect(refused.headers.get('www-authenticate')).toContain('error="invalid_token"');
    }
  });

  it('rotates refresh tokens and ends the connection when one is replayed', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    const provider = new MemoryOAuthProvider(DESK_CLIENT, DESK_REDIRECT);
    await steps.signIn(provider);
    const first = provider.saved!;
    const refreshed = await steps.postForm('/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: first.refresh_token!,
      client_id: DESK_CLIENT,
      resource: `${base}/mcp`,
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.headers.get('cache-control')).toBe('no-store');
    expect(refreshed.body['refresh_token']).not.toBe(first.refresh_token);
    const fresh = String(refreshed.body['access_token']);
    expect((await steps.listTools('', fresh)).status).toBe(200);
    const replayed = await steps.postForm('/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: first.refresh_token!,
      client_id: DESK_CLIENT,
    });
    expect(replayed).toMatchObject({ status: 400, body: { error: 'invalid_grant' } });
    // Every token of the connection is dead, the newest included.
    expect((await steps.listTools('', fresh)).status).toBe(401);
    const [revoked] = await sql()`
      SELECT after FROM audit_log WHERE action = 'oauth.grant_revoked' ORDER BY id DESC LIMIT 1`;
    expect(revoked?.['after']).toMatchObject({ reason: 'refresh_token_reused' });
  });

  it('lets the person deny, list and disconnect apps, and the client revoke', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    const denied = new MemoryOAuthProvider(DESK_CLIENT, DESK_REDIRECT, 'deny-state');
    const { url } = await steps.start(denied);
    const { redirect } = await steps.consent(url, { approve: false });
    expect(redirect.searchParams.get('error')).toBe('access_denied');
    expect(redirect.searchParams.get('state')).toBe('deny-state');
    expect(redirect.searchParams.get('code')).toBeNull();

    const provider = new MemoryOAuthProvider(DESK_CLIENT, DESK_REDIRECT);
    await steps.signIn(provider);
    const grants = (await run.call('GET', '/oauth/grants'))!.items as {
      id: string;
      client: { name: string };
      access: string;
    }[];
    expect(grants[0]).toMatchObject({ client: { name: 'Desk Assistant' }, access: 'write' });
    await run.call('DELETE', `/oauth/grants/${grants[0]!.id}`);
    expect((await steps.listTools('', provider.saved!.access_token)).status).toBe(401);

    const other = new MemoryOAuthProvider(DESK_CLIENT, DESK_REDIRECT);
    await steps.signIn(other);
    const revoke = await steps.postForm('/oauth/revoke', {
      token: other.saved!.refresh_token!,
      client_id: DESK_CLIENT,
    });
    expect(revoke.status).toBe(200);
    expect((await steps.listTools('', other.saved!.access_token)).status).toBe(401);
    const audit = await sql()`
      SELECT action FROM audit_log
      WHERE action IN ('oauth.authorization_denied', 'oauth.grant_revoked')`;
    expect(audit.map((row) => row['action'])).toEqual(
      expect.arrayContaining(['oauth.authorization_denied', 'oauth.grant_revoked']),
    );
  });
});
