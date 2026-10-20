import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { DEFAULT_UPLOAD_MAX_BYTES } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, connect, createToken, textOf } from './mcp-harness.ts';
import {
  DESK_CLIENT,
  DESK_REDIRECT,
  MemoryOAuthProvider,
  oauthSteps,
  startOAuthRun,
  type OAuthRun,
} from './mcp-oauth-harness.ts';

/*
 * An agent attaching a file too large for a tool call (ADR 0048) against the real host: the
 * MCP tool hands out a link, the bytes go to it over plain HTTP with no other credential, and
 * a second tool call places the stored file. The link is single use, expires, keeps the files
 * service's size limit and sniffing, and acts only while its person and connection may.
 */

/** Inside the MCP stream's assigned range. */
const PORT = 3543;

/** A PDF of `size` bytes: the magic number, padding, the end marker. */
function pdfOf(size: number): Buffer {
  const head = Buffer.from('%PDF-1.7\n');
  const tail = Buffer.from('\n%%EOF\n');
  return Buffer.concat([head, Buffer.alloc(size - head.length - tail.length, 0x20), tail]);
}

interface Link {
  url: string;
  method: string;
  expiresAt: string;
  maxBytes: number;
  command: string;
}

describe('upload links', () => {
  let run: OAuthRun | undefined;
  let skipReason = '';
  let pageId = '';
  let editor = '';
  let editorTokenId = '';
  let sam: { id: string; cookie: string };
  let samToken = '';

  beforeAll(async () => {
    const started = await startOAuthRun(PORT);
    if (!started.run) {
      skipReason = started.reason;
      return;
    }
    run = started.run;
    const [page] = await sql()<{ id: string }[]>`select id from pages where title = 'Cache plan'`;
    pageId = page!.id;
    const created = (await run.call('POST', '/api-tokens', {
      name: 'Agent',
      scopes: ['read', 'write'],
    }))!;
    editor = created.token as string;
    editorTokenId = (created.apiToken as { id: string }).id;
    sam = await addMember(run.app, run.call, 'sam@acmelabs.dev', 'Sam R.', run.base);
    samToken = await createToken(run.call, { name: 'Sam', scopes: ['read', 'write'] }, sam.cookie);
  });

  afterAll(async () => run?.harness.stop());

  const sql = () => run!.app.instance.database!.sql;

  async function tool(client: Client, name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    return { isError: Boolean(result.isError), text: textOf(result) };
  }

  async function linkFor(client: Client, name = 'spec.pdf'): Promise<Link> {
    const result = await tool(client, 'docs.create_upload_link', { pageId, name });
    expect(result.isError, result.text).toBe(false);
    return JSON.parse(result.text) as Link;
  }

  /** What the agent's shell does: the bytes, no cookie, no Authorization, no Content-Type. */
  const put = (url: string, body: Buffer) =>
    fetch(url, { method: 'PUT', body: new Uint8Array(body) });

  const blocksOf = async () => {
    const page = (await run!.call('GET', `/docs/pages/${pageId}`))!;
    return ((page.snapshot as { content?: { type: string; attrs?: object }[] }).content ?? []) as {
      type: string;
      attrs?: Record<string, unknown>;
    }[];
  };

  it('attaches a 5 MB PDF: a link, a PUT of the bytes, then the file placed', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    const client = await connect(run.base, '', editor);
    try {
      const link = await linkFor(client, 'quarterly.pdf');
      expect(link.url).toMatch(
        new RegExp(`^${run.base}/api/v1/upload-links/bmu_[A-Za-z0-9_-]{43}$`),
      );
      expect(link).toMatchObject({ method: 'PUT', maxBytes: DEFAULT_UPLOAD_MAX_BYTES });
      expect(link.command).toBe(`curl --fail-with-body -T 'quarterly.pdf' '${link.url}'`);
      // The database's clock sets it; a container's may run a little apart from this one.
      expect((Date.parse(link.expiresAt) - Date.now()) / 60_000).toBeCloseTo(15, 0);

      const pdf = pdfOf(5 * 1024 * 1024);
      const sent = await put(link.url, pdf);
      expect(sent.status).toBe(201);
      const file = (await sent.json()) as { id: string; url: string; size: number };
      expect(file).toMatchObject({ name: 'quarterly.pdf', mime: 'application/pdf' });
      expect(file.size).toBe(pdf.length);

      const placed = await tool(client, 'docs.upload_file', { pageId, fileId: file.id });
      expect(placed.isError, placed.text).toBe(false);
      expect(JSON.parse(placed.text)).toMatchObject({ id: file.id, appended: true });
      expect((await blocksOf()).at(-1)).toEqual({
        type: 'file',
        attrs: { src: file.url, name: 'quarterly.pdf', mime: 'application/pdf' },
      });
      const served = await run.app.inject({ method: 'GET', url: file.url });
      expect(served.rawPayload.equals(pdf)).toBe(true);

      // Single use: the same link stores nothing more.
      const again = await put(link.url, pdfOf(1024));
      expect(again.status).toBe(404);
      expect(await again.json()).toMatchObject({ details: { reason: 'used' } });
    } finally {
      await client.close();
    }
    const [row] = await sql()<{ user_id: string; credential_id: string; file_id: string }[]>`
      select user_id, credential_id, file_id from file_upload_links order by id limit 1`;
    expect(row!.credential_id).toBe(editorTokenId);
    const audited = await sql()<{ target_id: string }[]>`
      select target_id from audit_log where action = 'mcp.tool_called' order by id`;
    expect(audited.map((entry) => entry.target_id)).toEqual([
      'docs.create_upload_link',
      'docs.upload_file',
    ]);
  });

  it('keeps the size limit and sniffing, giving the link back for invalid bytes', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    const client = await connect(run.base, '', editor);
    try {
      const link = await linkFor(client);
      // Refused before the link is read, so it still works afterwards.
      const big = await put(link.url, pdfOf(DEFAULT_UPLOAD_MAX_BYTES + 1));
      expect(big.status).toBe(413);
      const zip = await put(link.url, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]));
      expect(zip.status).toBe(400);
      expect(await zip.json()).toMatchObject({ details: { reason: 'unsupported_type' } });
      const pdf = await put(link.url, pdfOf(2048));
      expect(pdf.status).toBe(201);
      expect(await pdf.json()).toMatchObject({ name: 'spec.pdf', mime: 'application/pdf' });
    } finally {
      await client.close();
    }
  });

  it('expires after 15 minutes, and housekeeping drops old links', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    const client = await connect(run.base, '', editor);
    let link: Link;
    try {
      link = await linkFor(client);
    } finally {
      await client.close();
    }
    const token = link.url.split('/').at(-1)!;
    await sql()`
      update file_upload_links set expires_at = now() - interval '1 second'
      where used_at is null and file_id is null`;
    const late = await put(link.url, pdfOf(1024));
    expect(late.status).toBe(404);
    expect(await late.json()).toMatchObject({ details: { reason: 'expired' } });

    const unknown = await put(link.url.replace(token, `bmu_${'x'.repeat(43)}`), pdfOf(1024));
    expect(unknown.status).toBe(404);
    expect((await put(link.url.replace(token, 'not-a-token'), pdfOf(1024))).status).toBe(400);

    const files = run.app.instance.kernel!.files;
    expect(await files.cleanupLinks()).toBe(0);
    const [all] = await sql()<{ count: number }[]>`
      select count(*)::int as count from file_upload_links`;
    expect(await files.cleanupLinks(new Date(Date.now() + 2 * 86_400_000))).toBe(all!.count);
  });

  it('acts as the person: a viewer, a narrowed or revoked token store nothing', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    const roles = (await run.call('GET', '/roles'))!.items as { id: string; key: string }[];
    const roleOf = (key: string) => roles.find((role) => role.key === key)!.id;
    const setRole = (key: string) =>
      run!.call('PUT', `/docs/spaces/ENG/members/${sam.id}`, { roleId: roleOf(key) });

    await setRole('viewer');
    const viewer = await connect(run.base, '', samToken);
    try {
      const refused = await tool(viewer, 'docs.create_upload_link', { pageId, name: 'x.pdf' });
      expect(refused.isError).toBe(true);
    } finally {
      await viewer.close();
    }

    await setRole('member');
    const client = await connect(run.base, '', samToken);
    let link: Link;
    try {
      link = await linkFor(client);
    } finally {
      await client.close();
    }
    // Checked again on use: the space role changed after the link was made.
    await setRole('viewer');
    expect((await put(link.url, pdfOf(1024))).status).toBe(403);

    await setRole('member');
    const second = await connect(run.base, '', samToken);
    let narrowed: Link;
    try {
      narrowed = await linkFor(second);
      link = await linkFor(second);
    } finally {
      await second.close();
    }
    const tokens = (await run.call('GET', '/api-tokens', undefined, sam.cookie))!.items as {
      id: string;
    }[];
    // A token that no longer reaches Docs cannot write there through a link either.
    await sql()`update api_tokens set modules = '{work}' where id = ${tokens[0]!.id}`;
    const outside = await put(narrowed.url, pdfOf(1024));
    expect(outside.status).toBe(403);
    expect(await outside.json()).toMatchObject({ details: { reason: 'revoked' } });
    await sql()`update api_tokens set modules = null where id = ${tokens[0]!.id}`;

    await run.call('DELETE', `/api-tokens/${tokens[0]!.id}`, undefined, sam.cookie);
    const revoked = await put(link.url, pdfOf(1024));
    expect(revoked.status).toBe(403);
    expect(await revoked.json()).toMatchObject({ details: { reason: 'revoked' } });
  });

  it('ends with the OAuth connection that asked for it', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    const steps = oauthSteps(run);
    const provider = new MemoryOAuthProvider(DESK_CLIENT, DESK_REDIRECT, 'state-links');
    await steps.signIn(provider);
    const client = await steps.connect(provider);
    let link: Link;
    try {
      link = await linkFor(client);
    } finally {
      await client.close();
    }
    const grants = (await run.call('GET', '/oauth/grants'))!.items as { id: string }[];
    const [row] = await sql()<{ credential_id: string }[]>`
      select credential_id from file_upload_links order by id desc limit 1`;
    expect(grants.map((grant) => grant.id)).toContain(row!.credential_id);
    await run.call('DELETE', `/oauth/grants/${row!.credential_id}`);
    const revoked = await put(link.url, pdfOf(1024));
    expect(revoked.status).toBe(403);
    expect(await revoked.json()).toMatchObject({ details: { reason: 'revoked' } });
  });

  it('is offered to read-and-write connections only', async (ctx) => {
    if (!run) return ctx.skip(skipReason);
    const reader = await createToken(run.call, { name: 'Reader', scopes: ['read'] });
    const client = await connect(run.base, '', reader);
    try {
      const names = (await client.listTools()).tools.map((listed) => listed.name);
      expect(names).toContain('docs.get_page');
      expect(names).not.toContain('docs.create_upload_link');
    } finally {
      await client.close();
    }
  });
});
