import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BOOT_ORIGIN,
  startBootHarness,
  type BootHarness,
  type SignedInApp,
} from './boot-harness.ts';

/*
 * The workspace logo on the real boot path: only people who manage appearance may set or
 * remove it, the bytes decide what is accepted (PNG, WebP or a plain SVG, near-square, big
 * enough), it is served anonymously from this origin with a long cache and an etag, and the
 * sign-in page learns where it is from setup status.
 */

function pngOf(width: number, height: number): Buffer {
  const header = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return header;
}

const SVG = Buffer.from(
  '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<rect width="32" height="32" fill="#123456"/></svg>',
);
const EVIL_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" onload="alert(1)"></svg>',
);

describe('workspace logo api', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startBootHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });

  afterAll(async () => harness?.stop());

  async function joinAsMember(app: SignedInApp): Promise<string> {
    const roles = (await app.inject({ method: 'GET', url: '/api/v1/roles' })).json().items as {
      id: string;
      key: string;
    }[];
    const invited = await app.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      payload: { emails: ['mo@acmelabs.dev'], roleId: roles.find((r) => r.key === 'member')!.id },
    });
    const token = /token=([\w-]+)/.exec(invited.json().items[0].acceptUrl as string)![1];
    const accepted = await app.instance.app.inject({
      method: 'POST',
      url: `/api/v1/auth/invitations/${token}/accept`,
      headers: { origin: BOOT_ORIGIN },
      payload: { name: 'Mo', password: 'twelve chars ok' },
    });
    const header = accepted.headers['set-cookie'];
    return (Array.isArray(header) ? header : [header ?? ''])
      .map((value) => value.split(';')[0])
      .join('; ');
  }

  it('uploads, sanitises, serves, replaces and removes the logo', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.boot('');
    const upload = (body: Buffer, cookie?: string) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/workspace/logo',
        headers: { 'content-type': 'image/png', ...(cookie ? { cookie } : {}) },
        payload: body,
      });
    const anonymous = (url: string, headers: Record<string, string> = {}) =>
      app.instance.app.inject({ method: 'GET', url, headers });

    // Refusals say why, in details.reason.
    const reasons = async (body: Buffer) => (await upload(body)).json().details?.reason;
    expect(await reasons(pngOf(64, 64))).toBe('too_small');
    expect(await reasons(pngOf(600, 200))).toBe('not_square');
    expect(await reasons(EVIL_SVG)).toBe('unsafe_svg');
    expect(await reasons(Buffer.from('GIF89a'))).toBe('unsupported_type');
    expect(await reasons(Buffer.concat([pngOf(256, 256), Buffer.alloc(1024 * 1024)]))).toBe(
      'too_large',
    );

    // Members without workspace.appearance.manage may not set or remove it.
    const member = await joinAsMember(app);
    expect((await upload(pngOf(256, 256), member)).statusCode).toBe(403);
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: '/api/v1/workspace/logo',
          headers: { cookie: member },
        })
      ).statusCode,
    ).toBe(403);

    // A plain SVG is stored without its XML prolog and served inert.
    const stored = await upload(SVG);
    expect(stored.statusCode).toBe(201);
    const logo = stored.json();
    expect(logo).toMatchObject({ mime: 'image/svg+xml', width: null });
    expect(logo.logoKey).toMatch(/^\/api\/v1\/workspace\/logo\/[0-9a-f]{64}\.svg$/);
    const served = await anonymous(logo.logoKey);
    expect(served.statusCode).toBe(200);
    expect(served.body.startsWith('<svg ')).toBe(true);
    expect(served.headers).toMatchObject({
      'content-type': 'image/svg+xml',
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=31536000, immutable',
    });
    expect(served.headers['content-security-policy']).toContain('sandbox');
    const etag = served.headers.etag as string;
    expect((await anonymous(logo.logoKey, { 'if-none-match': etag })).statusCode).toBe(304);

    // The sign-in page and /me learn where it is.
    const status = (await anonymous('/api/v1/setup/status')).json();
    expect(status.logoUrl).toBe(logo.logoKey);

    // Replacing it retires the old path; the audit log names both.
    const replaced = (await upload(pngOf(256, 240))).json();
    expect(replaced).toMatchObject({ mime: 'image/png', width: 256, height: 240 });
    expect((await anonymous(logo.logoKey)).statusCode).toBe(404);
    expect((await anonymous(replaced.logoKey)).statusCode).toBe(200);

    const removed = await app.inject({ method: 'DELETE', url: '/api/v1/workspace/logo' });
    expect(removed.statusCode).toBe(204);
    expect((await anonymous(replaced.logoKey)).statusCode).toBe(404);
    expect((await anonymous('/api/v1/setup/status')).json().logoUrl).toBeNull();
    expect((await anonymous('/api/v1/workspace/logo/nothing.png')).statusCode).toBe(400);

    const actions = await app.instance.database!.sql<{ action: string }[]>`
      select action from audit_log where action like 'workspace.logo_%' order by created_at`;
    expect(actions.map((row) => row.action)).toEqual([
      'workspace.logo_added',
      'workspace.logo_replaced',
      'workspace.logo_removed',
    ]);
  });
});
