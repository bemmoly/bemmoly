import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness, type SignedInApp } from './boot-harness.ts';
import { caller } from './mcp-harness.ts';

/*
 * Device sign-in for bp (RFC 8628): the tool asks for a code, the signed-in admin approves
 * it on /device, the tool polls and collects an API token limited to Pipelines.
 */

const CLIENT = 'bemmoly-pipelines-cli';
const GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

describe('oauth device sign-in', () => {
  let harness: BootHarness | undefined;
  let app: SignedInApp;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startBootHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    app = await harness.boot();
    await caller(app)('POST', '/admin/modules/pipelines/enable', { access: { mode: 'everyone' } });
  });

  afterAll(async () => harness?.stop());

  /** The tool's side: anonymous form posts, as a command line client sends them. */
  const form = (url: string, fields: Record<string, string>) =>
    app.instance.app.inject({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(fields).toString(),
    });
  const start = () =>
    form('/oauth/device_authorization', { client_id: CLIENT, device_name: 'bp on build-box' });
  const pollWith = (deviceCode: string) =>
    form('/oauth/token', { grant_type: GRANT, device_code: deviceCode, client_id: CLIENT });
  const sql = () => app.instance.database!.sql;
  const rewindPoll = (code: string) =>
    sql()`UPDATE oauth_device_codes SET last_polled_at = now() - interval '1 minute'
      WHERE user_code = ${code}`;

  it('advertises the device endpoint in the server metadata', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const metadata = (
      await app.instance.app.inject({ url: '/.well-known/oauth-authorization-server' })
    ).json();
    expect(metadata.device_authorization_endpoint).toMatch(/\/oauth\/device_authorization$/);
    expect(metadata.grant_types_supported).toContain(GRANT);
  });

  it('issues a Pipelines-only API token once the person approves', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const started = await start();
    expect(started.statusCode).toBe(200);
    const body = started.json();
    expect(body).toMatchObject({ expires_in: 600, interval: 5 });
    expect(body.user_code).toMatch(/^[B-DF-HJ-NP-TV-XZ]{4}-[B-DF-HJ-NP-TV-XZ]{4}$/);
    expect(body.verification_uri_complete).toContain(`/device?code=${body.user_code}`);

    const pending = await pollWith(body.device_code);
    expect(pending.statusCode).toBe(400);
    expect(pending.json().error).toBe('authorization_pending');
    expect((await pollWith(body.device_code)).json().error).toBe('slow_down');

    const lowerCase = body.user_code.toLowerCase().replace('-', ' ');
    const preview = await app.inject({
      url: `/api/v1/oauth/device-requests?userCode=${encodeURIComponent(lowerCase)}`,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ deviceName: 'bp on build-box', modules: ['pipelines'] });
    const decided = await app.inject({
      method: 'POST',
      url: '/api/v1/oauth/device-decisions',
      payload: { userCode: body.user_code, approve: true },
    });
    expect(decided.statusCode).toBe(201);

    await rewindPoll(body.user_code);
    const issued = await pollWith(body.device_code);
    expect(issued.statusCode).toBe(200);
    const token = issued.json();
    expect(token).toMatchObject({ token_type: 'Bearer', scope: 'read write' });
    expect(token.access_token).toMatch(/^bmy_/);
    const me = await app.instance.app.inject({
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    expect(me.statusCode).toBe(200);
    const [row] =
      await sql()`SELECT modules, name FROM api_tokens ORDER BY created_at DESC LIMIT 1`;
    expect(row).toMatchObject({ modules: ['pipelines'], name: 'bp on build-box' });

    const again = await pollWith(body.device_code);
    expect(again.json().error).toBe('invalid_grant');
  });

  it('answers access_denied when the person refuses', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const body = (await start()).json();
    await app.inject({
      method: 'POST',
      url: '/api/v1/oauth/device-decisions',
      payload: { userCode: body.user_code, approve: false },
    });
    expect((await pollWith(body.device_code)).json().error).toBe('access_denied');
  });

  it('refuses tools that are not Bemmoly’s own and codes nobody issued', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const stranger = await form('/oauth/device_authorization', {
      client_id: 'https://evil.example/c.json',
    });
    expect(stranger.statusCode).toBe(401);
    expect(stranger.json().error).toBe('invalid_client');
    expect((await pollWith('bmo_dc_made_up')).json().error).toBe('invalid_grant');
    const preview = await app.inject({ url: '/api/v1/oauth/device-requests?userCode=BCDF-GHJK' });
    expect(preview.statusCode).toBe(404);
  });
});
