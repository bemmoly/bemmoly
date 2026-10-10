import { eventually, type CollabTestClient } from '@bemmoly/core/testing';
import { plainText } from '@bemmoly/editor/convert';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Doc } from 'yjs';
import type { RichText } from '../../../../shared/common.ts';
import { startCollabServer, type CollabServer } from '../collab/collab-support.ts';
import { docToSnapshot, writeSnapshot } from '../collab/convert.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

const doc = (...lines: string[]) =>
  ({
    type: 'doc',
    content: lines.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
  }) as RichText;
const textOf = (yDoc: Doc) => plainText(docToSnapshot(yDoc) as Parameters<typeof plainText>[0]);

describe('restoring a revision while people have the page open', () => {
  let harness: DocsHarness | null = null;
  let server: CollabServer | null = null;
  let skipReason = '';
  const clients: CollabTestClient[] = [];

  beforeAll(async () => {
    const started = await startDocsHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    server = await startCollabServer(harness);
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.destroy();
  });

  afterAll(async () => {
    await server?.stop();
    await harness?.stop();
  });

  const pageText = async (id: string) =>
    (await harness!.sql<{ text: string }[]>`select text from pages where id = ${id}`)[0]?.text;

  async function waitFor(check: () => Promise<boolean>, timeoutMs = 8_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!(await check())) {
      if (Date.now() > deadline) throw new Error('timed out waiting for the database');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  it('sends the restored content to open editors and records a restore revision', async (ctx) => {
    if (!harness || !server) return ctx.skip(skipReason);
    const { users, as } = harness;
    const { services } = server;
    const space = await harness.space('RST');
    const page = await services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'Spec',
    });
    const mo = server.open(users.member, page.id);
    const ada = server.open(users.admin, page.id);
    clients.push(mo, ada);
    await Promise.all([mo.synced, ada.synced]);

    writeSnapshot(mo.doc, doc('Version one', 'Keep this line'));
    await waitFor(async () => (await pageText(page.id)) === 'Version one\nKeep this line');
    const saved = await services.revisions.create(as(users.member), page.id, { label: 'One' });
    expect(saved.authorIds).toEqual([users.member]);

    writeSnapshot(ada.doc, doc('Version two', 'Keep this line', 'Added later'));
    await waitFor(async () => (await pageText(page.id))?.startsWith('Version two') ?? false);

    const restored = await services.revisions.restore(as(users.admin), page.id, saved.id);
    expect(restored).toMatchObject({ kind: 'restore', number: 2, label: 'Restored from v1' });
    await eventually(() => textOf(mo.doc) === 'Version one\nKeep this line');
    await eventually(() => textOf(ada.doc) === 'Version one\nKeep this line');
    await waitFor(async () => (await pageText(page.id)) === 'Version one\nKeep this line');

    // The restore is an edit like any other: the next keystroke builds on it.
    writeSnapshot(mo.doc, doc('Version one', 'Keep this line', 'After restore'));
    await eventually(() => textOf(ada.doc).endsWith('After restore'));
    const history = await services.revisions.list(as(users.viewer), page.id, { limit: 10 });
    expect(history.items.map((item) => item.kind)).toEqual(['restore', 'named']);
  });
});
