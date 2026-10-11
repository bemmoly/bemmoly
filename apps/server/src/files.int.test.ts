import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BOOT_ORIGIN, startBootHarness, type BootHarness, type SignedInApp } from './boot-harness.ts';

/*
 * Images in pages through the kernel's files API, on the real boot path: who may add and
 * read them (the page's edit and view rights), what is accepted (the bytes decide, never the
 * name or the Content-Type), the size and rate limits, the headers they are served with,
 * and the cleanup of files no page refers to any more.
 */

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const SVG = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
const HTML = Buffer.from('<html><script>alert(1)</script></html>');
const UPLOADS_PER_MINUTE = 9;

describe('files api', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startBootHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });

  afterAll(async () => harness?.stop());

  async function join(app: SignedInApp, email: string, roleId: string) {
    const invited = await app.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      payload: { emails: [email], roleId },
    });
    const token = /token=([\w-]+)/.exec(invited.json().items[0].acceptUrl as string)![1];
    const accepted = await app.instance.app.inject({
      method: 'POST',
      url: `/api/v1/auth/invitations/${token}/accept`,
      headers: { origin: BOOT_ORIGIN },
      payload: { name: email.split('@')[0], password: 'twelve chars ok' },
    });
    const header = accepted.headers['set-cookie'];
    const cookie = (Array.isArray(header) ? header : [header ?? ''])
      .map((value) => value.split(';')[0])
      .join('; ');
    return { id: accepted.json().user.id as string, cookie };
  }

  it('stores images for editors, serves them to readers and cleans up orphans', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.boot('', {
      BEMMOLY_UPLOAD_MAX_BYTES: String(64 * 1024),
      BEMMOLY_RATE_LIMIT_UPLOADS_PER_USER: String(UPLOADS_PER_MINUTE),
    });
    const json = async (method: string, url: string, payload?: unknown) => {
      const response = await app.inject({
        method: method as 'GET',
        url: `/api/v1${url}`,
        ...(payload !== undefined ? { payload: payload as object } : {}),
      });
      if (response.statusCode >= 400) throw new Error(`${method} ${url}: ${response.body}`);
      return response.statusCode === 204 ? null : response.json();
    };
    await json('POST', '/admin/modules/docs/enable', { access: { mode: 'everyone' } });
    const roles = (await json('GET', '/roles')).items as { id: string; key: string }[];
    const roleOf = (key: string) => roles.find((role) => role.key === key)!.id;
    const viewer = await join(app, 'vee@acmelabs.dev', roleOf('member'));
    const outsider = await join(app, 'otto@acmelabs.dev', roleOf('member'));
    const space = await json('POST', '/docs/spaces', { key: 'IMG', name: 'Images' });
    await json('PUT', `/docs/spaces/IMG/members/${viewer.id}`, { roleId: roleOf('viewer') });
    const page = await json('POST', '/docs/pages', { spaceId: space.id, title: 'Diagrams' });

    const upload = (body: Buffer, as?: string, name = 'shot.png', type = 'image/png') =>
      app.inject({
        method: 'POST',
        url: `/api/v1/files?target=docs.page&targetId=${page.id}&name=${encodeURIComponent(name)}`,
        headers: { 'content-type': type, ...(as ? { cookie: as } : {}) },
        payload: body,
      });
    const read = (id: string, as?: string) =>
      app.inject({ method: 'GET', url: `/api/v1/files/${id}`, ...(as ? { headers: { cookie: as } } : {}) });

    // The bytes decide: a PNG sent as SVG under a path-like name is stored as a PNG.
    const stored = await upload(PNG, undefined, '../../etc/diagram.svg', 'image/svg+xml');
    expect(stored.statusCode).toBe(201);
    const file = stored.json();
    expect(file).toMatchObject({ mime: 'image/png', name: 'diagram.png', size: PNG.length });
    expect(file.url).toBe(`/api/v1/files/${file.id}`);
    const [row] = await app.instance.database!.sql<{ storage_key: string }[]>`
      select storage_key from files where id = ${file.id}`;
    // Under the attachments folder every backup copies.
    expect(row!.storage_key).toMatch(/^attachments\/files\/sha256\//);

    const served = await read(file.id);
    expect(served.statusCode).toBe(200);
    expect(served.rawPayload.equals(PNG)).toBe(true);
    expect(served.headers).toMatchObject({
      'content-type': 'image/png',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    });

    // SVG, anything that is not an image, and nothing at all are refused.
    const svg = await upload(SVG, undefined, 'logo.png');
    expect(svg.statusCode).toBe(400);
    expect(svg.json().details).toMatchObject({ reason: 'svg_refused' });
    const html = await upload(HTML, undefined, 'cat.png');
    expect(html.statusCode).toBe(400);
    expect(html.json().details).toMatchObject({ reason: 'unsupported_type' });
    expect((await upload(Buffer.alloc(0))).statusCode).toBe(400);
    // Over the size limit, before the service reads a byte.
    const big = Buffer.concat([PNG, Buffer.alloc(70 * 1024)]);
    expect((await upload(big)).statusCode).toBe(413);

    // Viewers read but may not add; people outside the space do neither, and are not told it exists.
    expect((await upload(PNG, viewer.cookie)).statusCode).toBe(403);
    expect((await read(file.id, viewer.cookie)).statusCode).toBe(200);
    expect((await read(file.id, outsider.cookie)).statusCode).toBe(404);
    // Signed out: nothing.
    const anonymous = await app.instance.app.inject({ method: 'GET', url: `/api/v1/files/${file.id}` });
    expect(anonymous.statusCode).toBe(401);
    // A kind nothing registered.
    const unknown = await app.inject({
      method: 'POST',
      url: `/api/v1/files?target=docs.nothing&targetId=${page.id}`,
      headers: { 'content-type': 'image/png' },
      payload: PNG,
    });
    expect(unknown.statusCode).toBe(404);

    // Cleanup: a day later, the image the page shows stays and the abandoned one goes.
    const orphan = (await upload(Buffer.concat([PNG, Buffer.from('another')]))).json();
    const sql = app.instance.database!.sql;
    const snapshot = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: file.url, alt: 'Diagram' } }],
    };
    await sql`update pages set snapshot = ${JSON.stringify(snapshot)}::jsonb where id = ${page.id}`;
    await sql`update files set created_at = now() - interval '2 days'`;
    expect(await app.instance.kernel!.files.cleanup()).toBe(1);
    expect((await read(file.id)).statusCode).toBe(200);
    expect((await read(orphan.id)).statusCode).toBe(404);

    // Each person has an upload budget of their own: refused uploads count too.
    const statuses: number[] = [];
    for (let i = 0; i <= UPLOADS_PER_MINUTE; i += 1) {
      statuses.push((await upload(PNG, outsider.cookie)).statusCode);
    }
    expect(statuses.slice(0, UPLOADS_PER_MINUTE).every((status) => status === 403)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});
