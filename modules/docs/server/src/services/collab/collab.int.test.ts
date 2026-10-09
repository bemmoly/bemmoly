import { eventually, type CollabTestClient } from '@bemmoly/core/testing';
import { plainText } from '@bemmoly/editor/convert';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { XmlElement, XmlText, type Doc } from 'yjs';
import type { RichText } from '../../../../shared/common.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';
import { startCollabServer, type CollabServer } from './collab-support.ts';
import { docToSnapshot, PAGE_FIELD, writeSnapshot } from './convert.ts';

const doc = (...blocks: unknown[]) => ({ type: 'doc', content: blocks }) as RichText;
const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const textOf = (yDoc: Doc) => plainText(docToSnapshot(yDoc) as Parameters<typeof plainText>[0]);
const body = (yDoc: Doc) => yDoc.getXmlFragment(PAGE_FIELD);

function paragraph(text: string): XmlElement {
  const element = new XmlElement('paragraph');
  element.insert(0, [new XmlText(text)]);
  return element;
}

describe('collaborative pages', () => {
  let harness: DocsHarness | null = null;
  let server: CollabServer | null = null;
  let skipReason = '';
  const clients: CollabTestClient[] = [];
  const open = (userId: string, pageId: string) => {
    const client = server!.open(userId, pageId);
    clients.push(client);
    return client;
  };
  const pageRow = async (id: string) => {
    const [row] = await harness!.sql<{ text: string; word_count: number; updated_by: string }[]>`
      select text, word_count, updated_by from pages where id = ${id}`;
    return row!;
  };

  beforeAll(async () => {
    const started = await startDocsHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    server = await startCollabServer(harness, { compactThreshold: 8 });
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.destroy();
  });

  afterAll(async () => {
    await server?.stop();
    await harness?.stop();
  });

  it('lets two people edit one page at once and converges', async (ctx) => {
    if (!harness || !server) return ctx.skip(skipReason);
    const { users, as } = harness;
    const space = await harness.space('COL');
    const page = await server.services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'Plan',
    });
    const mo = open(users.member, page.id);
    const ada = open(users.admin, page.id);
    await Promise.all([mo.synced, ada.synced]);
    body(mo.doc).push([paragraph('Alpha')]);
    body(ada.doc).push([paragraph('Beta')]);
    for (let i = 0; i < 10; i += 1) {
      const first = body(mo.doc).get(0) as XmlElement | undefined;
      (first?.get(0) as XmlText | undefined)?.insert(0, 'm');
      const last = body(ada.doc).get(body(ada.doc).length - 1) as XmlElement | undefined;
      (last?.get(0) as XmlText | undefined)?.insert(0, 'a');
    }
    await eventually(() => textOf(mo.doc) === textOf(ada.doc) && /Alpha/.test(textOf(mo.doc)));
    expect(textOf(mo.doc)).toMatch(/Beta/);
    expect(textOf(mo.doc).match(/[ma]/g)?.length).toBeGreaterThanOrEqual(20);
    await waitFor(async () => (await pageRow(page.id)).text === textOf(mo.doc));
    const row = await pageRow(page.id);
    expect(row.word_count).toBe(2);
    expect([users.member, users.admin]).toContain(row.updated_by);
    const [audit] = await harness.sql<{ after: { editors: string[] } }[]>`
      select after from audit_log where action = 'page.content_edited' and target_id = ${page.id}
      order by created_at desc limit 1`;
    expect(audit?.after.editors.sort()).toEqual([users.member, users.admin].sort());

    // A restart: the next server starts from the database alone.
    const before = textOf(mo.doc);
    for (const client of clients.splice(0)) client.destroy();
    await server.stop();
    server = await startCollabServer(harness, { compactThreshold: 8 });
    const again = open(users.member, page.id);
    await again.synced;
    expect(textOf(again.doc)).toBe(before);
  });

  it('extracts text and rewrites the page links from the body', async (ctx) => {
    if (!harness || !server) return ctx.skip(skipReason);
    const { users, as } = harness;
    const space = await harness.space('LNK');
    const member = as(users.member);
    const target = await server.services.pages.create(member, {
      spaceId: space.id,
      title: 'Runbook',
    });
    const page = await server.services.pages.create(member, { spaceId: space.id, title: 'Hub' });
    const mo = open(users.member, page.id);
    await mo.synced;
    const link = { type: 'pageLink', attrs: { pageId: target.id, title: 'Runbook' } };
    writeSnapshot(
      mo.doc,
      doc({ type: 'paragraph', content: [{ type: 'text', text: 'See ' }, link] }),
    );
    const edges = async () =>
      harness!.sql<{ target_id: string; kind: string }[]>`
        select target_id, kind from links where source_kind = 'page' and source_id = ${page.id}`;
    await waitFor(async () => (await edges()).length === 1);
    expect(await edges()).toEqual([{ target_id: target.id, kind: 'mention' }]);
    expect((await pageRow(page.id)).text).toBe('See Runbook');
    writeSnapshot(mo.doc, doc(para('No links now')));
    await waitFor(async () => (await edges()).length === 0);
    expect((await pageRow(page.id)).text).toBe('No links now');
  });

  it('compacts the update log into page_state without losing content', async (ctx) => {
    if (!harness || !server) return ctx.skip(skipReason);
    const { users, as, sql } = harness;
    const space = await harness.space('CMP');
    const page = await server.services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'Log',
    });
    const mo = open(users.member, page.id);
    await mo.synced;
    for (let i = 0; i < 12; i += 1) {
      body(mo.doc).push([paragraph(`line ${i}`)]);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    const count = async () =>
      Number((await sql`select count(*) from page_updates where page_id = ${page.id}`)[0]!.count);
    await waitFor(async () => server!.enqueued.some((job) => job.key?.includes(page.id)));
    const job = server.enqueued.find((queued) => queued.key?.includes(page.id))!;
    expect(job).toMatchObject({ name: 'docs.compact', payload: { pageId: page.id } });
    expect(job.key).toMatch(new RegExp(`^docs\\.compact:${page.id}:\\d+$`));
    expect(await count()).toBeGreaterThanOrEqual(8);
    const signal = new AbortController().signal;
    await server.compactJob.handle(job.payload, { jobId: 'j1', signal });
    expect(await count()).toBe(0);
    const [state] = await sql<{ folded_seq: string }[]>`
      select folded_seq from page_state where page_id = ${page.id}`;
    expect(Number(state?.folded_seq)).toBeGreaterThanOrEqual(8);
    await server.compactJob.handle(job.payload, { jobId: 'j2', signal });
    const fresh = open(users.admin, page.id);
    await fresh.synced;
    expect(textOf(fresh.doc)).toBe(textOf(mo.doc));
    body(mo.doc).push([paragraph('after compaction')]);
    await eventually(() => textOf(fresh.doc).endsWith('after compaction'));
  });

  it('converts a snapshot into the document once, on first open', async (ctx) => {
    if (!harness || !server) return ctx.skip(skipReason);
    const { users, as, sql } = harness;
    const space = await harness.space('SED');
    const page = await server.services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'From a template',
      snapshot: doc(para('Seeded body'), para('Second block')),
    });
    const first = open(users.member, page.id);
    await first.synced;
    expect(textOf(first.doc)).toBe('Seeded body\nSecond block');
    first.destroy();
    const second = open(users.admin, page.id);
    await second.synced;
    expect(textOf(second.doc)).toBe('Seeded body\nSecond block');
    const states = await sql`select folded_seq from page_state where page_id = ${page.id}`;
    expect(states).toHaveLength(1);
  });

  it('applies a snapshot sent to PATCH /pages/:id through the open document', async (ctx) => {
    if (!harness || !server) return ctx.skip(skipReason);
    const { users, as } = harness;
    const space = await harness.space('OLD');
    const page = await server.services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'Legacy client',
    });
    const mo = open(users.member, page.id);
    await mo.synced;
    const updated = await server.services.pages.update(as(users.member), page.id, {
      title: 'Renamed',
      snapshot: doc(para('Written the old way')),
    });
    expect(updated).toMatchObject({ title: 'Renamed', wordCount: 4 });
    await eventually(() => textOf(mo.doc) === 'Written the old way');
  });

  it('refuses people outside the space and opens viewers read-only', async (ctx) => {
    if (!harness || !server) return ctx.skip(skipReason);
    const { users, as } = harness;
    const space = await harness.space('ACL');
    const page = await server.services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'Members only',
    });
    expect(await open(users.outsider, page.id).refused).toBe('forbidden');
    const viewer = open(users.viewer, page.id);
    expect(await viewer.authenticated).toBe('readonly');
    expect(await open(users.member, '0193a1b2-0000-7000-8000-00000000dead').refused).toBe(
      'forbidden',
    );
  });
});

/** eventually() for checks that read the database. */
async function waitFor(check: () => Promise<boolean>, timeoutMs = 8_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('timed out waiting for the database');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
