import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setSetting } from './mcp-harness.ts';
import {
  CLI_CLIENT,
  DESK_CLIENT,
  DESK_REDIRECT,
  MemoryOAuthProvider,
  oauthSteps,
  startOAuthRun,
  type OAuthRun,
} from './mcp-oauth-harness.ts';

/*
 * What MCP client sign-in refuses: a wrong PKCE verifier, a reused code, a client secret, a
 * redirect the client never registered, a client id that is not an https document, consent
 * while MCP is off, and a burst of token requests from one address.
 */

/** Inside this stream's assigned range. */
const PORT = 3542;

describe('mcp oauth refusals', () => {
  let run: OAuthRun | undefined;
  let skipReason = '';
  let steps: ReturnType<typeof oauthSteps>;

  beforeAll(async () => {
    const started = await startOAuthRun(PORT);
    if (!started.run) {
      skipReason = started.reason;
      return;
    }
    run = started.run;
    steps = oauthSteps(run);
  });

  afterAll(async () => run?.harness.stop());

  const preview = (params: Record<string, string>) =>
    run!.app.inject({
      method: 'GET',
      url: `/api/v1/oauth/authorization-requests?${new URLSearchParams(params).toString()}`,
    });

  it('refuses a wrong verifier, a reused code and a client secret', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    const provider = new MemoryOAuthProvider(DESK_CLIENT, DESK_REDIRECT);
    const { url } = await steps.start(provider);
    const { redirect } = await steps.consent(url);
    const code = redirect.searchParams.get('code')!;
    const exchange = (verifier: string, extra: Record<string, string> = {}) =>
      steps.postForm('/oauth/token', {
        grant_type: 'authorization_code',
        code,
        redirect_uri: DESK_REDIRECT,
        client_id: DESK_CLIENT,
        code_verifier: verifier,
        ...extra,
      });
    expect((await exchange('x'.repeat(43))).body).toMatchObject({ error: 'invalid_grant' });
    const secret = await exchange(provider.codeVerifier(), { client_secret: 'guess' });
    expect(secret).toMatchObject({ status: 401, body: { error: 'invalid_client' } });
    const otherRedirect = await exchange(provider.codeVerifier(), {
      redirect_uri: 'http://localhost:9999/callback',
    });
    expect(otherRedirect.body).toMatchObject({ error: 'invalid_grant' });
    const good = await exchange(provider.codeVerifier());
    expect(good.status, JSON.stringify(good.body)).toBe(200);
    const again = await exchange(provider.codeVerifier());
    expect(again.body).toMatchObject({ error: 'invalid_grant' });
    // A code presented twice was intercepted, so what it became is revoked too.
    expect((await steps.listTools('', String(good.body['access_token']))).status).toBe(401);
    const unsupported = await steps.postForm('/oauth/token', { grant_type: 'password' });
    expect(unsupported.body).toMatchObject({ error: 'unsupported_grant_type' });
  });

  it('never redirects to an address the client did not register', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    const params = {
      response_type: 'code',
      client_id: CLI_CLIENT,
      redirect_uri: 'https://evil.example/callback',
      code_challenge: 'a'.repeat(43),
      code_challenge_method: 'S256',
      state: 's',
    };
    const evil = await preview(params);
    expect(evil.statusCode).toBe(400);
    expect(evil.json().details).toMatchObject({ reason: 'invalid_redirect' });
    expect(evil.body).not.toContain('redirectUrl');
    const decided = await run.app.inject({
      method: 'POST',
      url: '/api/v1/oauth/consents',
      payload: { request: params, approve: true },
    });
    expect(decided.statusCode).toBe(400);

    // Known client and redirect, but no PKCE: the error goes back to the client.
    const invalid = await preview({
      response_type: 'code',
      client_id: CLI_CLIENT,
      redirect_uri: 'https://cli.example/callback',
      state: 's',
    });
    expect(invalid.json()).toMatchObject({ status: 'invalid', error: 'invalid_request' });
    expect(invalid.json().redirectUrl).toMatch(/^https:\/\/cli\.example\/callback\?error=/);

    // A plain http client id is never fetched, and neither is a resource elsewhere accepted.
    expect((await preview({ ...params, client_id: 'http://cli.example/c.json' })).statusCode).toBe(
      400,
    );
    const elsewhere = await preview({
      ...params,
      redirect_uri: 'https://cli.example/callback',
      resource: 'https://other.example/mcp',
    });
    expect(elsewhere.json()).toMatchObject({ status: 'invalid', error: 'invalid_target' });
  });

  it('takes consent from a signed-in browser session only', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    const provider = new MemoryOAuthProvider(DESK_CLIENT, DESK_REDIRECT);
    const { url } = await steps.start(provider);
    const body = { request: Object.fromEntries(url.searchParams.entries()), approve: true };
    const crossSite = await run.app.inject({
      method: 'POST',
      url: '/api/v1/oauth/consents',
      headers: { origin: 'https://evil.example' },
      payload: body,
    });
    expect(crossSite.statusCode).toBe(403);
    const anonymous = await run.app.instance.app.inject({
      method: 'POST',
      url: '/api/v1/oauth/consents',
      headers: { origin: run.base },
      payload: body,
    });
    expect(anonymous.statusCode).toBe(401);
  });

  it('refuses consent while MCP is off, and limits token requests per address', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    await setSetting(run.call, 'mcp.enabled', false);
    const off = await preview({
      response_type: 'code',
      client_id: DESK_CLIENT,
      redirect_uri: DESK_REDIRECT,
    });
    expect(off.statusCode).toBe(403);
    expect(off.json().details).toMatchObject({ reason: 'mcp_disabled' });
    await setSetting(run.call, 'mcp.enabled', true);

    const statuses: number[] = [];
    for (let i = 0; i < 61; i += 1) {
      const response = await run.app.instance.app.inject({
        method: 'POST',
        url: '/oauth/token',
        remoteAddress: '10.20.30.40',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'grant_type=refresh_token&refresh_token=nope&client_id=x',
      });
      statuses.push(response.statusCode);
    }
    expect(statuses.slice(0, 60).every((status) => status === 400)).toBe(true);
    expect(statuses[60]).toBe(429);
  });
});
