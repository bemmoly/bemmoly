import { Readable } from 'node:stream';
import { deflateSync } from 'node:zlib';
import type { RequestContext } from '@bemmoly/core';
import { startTestPdfRenderer, type TestPdfRenderer } from '@bemmoly/core/testing';
import { NotFoundError } from '@bemmoly/shared';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RichText } from '../../../../shared/common.ts';
import type { PdfExport } from '../../../../shared/pdf-export.ts';
import { startDocsHttp, type DocsHttp } from '../../testing/http-support.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

/*
 * A page with an uploaded image, a table, code and an issue chip, and the page under it,
 * rendered to PDF by the real renderer image in a container (no network but what the app
 * sends), then read back: the text, the page count and the images painted.
 */

const IMAGE_ID = '0193a1b2-0000-7000-8000-00000000f001';
const HIDDEN_ID = '0193a1b2-0000-7000-8000-00000000f002';

/** A 16 × 16 opaque PNG, written by hand so the test needs no image library. */
function png(): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (data: Buffer) => {
    let c = 0xffffffff;
    for (const byte of data) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(16, 0);
  header.writeUInt32BE(16, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(48, 0x56)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: 16 }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const files = {
  read: async (_ctx: RequestContext, id: string) => {
    if (id !== IMAGE_ID) throw new NotFoundError('The file was not found');
    const data = png();
    return { name: 'flow.png', mime: 'image/png', size: data.length, body: Readable.from([data]) };
  },
};
const entities = {
  resolve: async (kind: string, ref: { id: string } | { key: string }) =>
    kind === 'issue' && 'key' in ref && ref.key === 'PLT-7'
      ? {
          kind: 'issue',
          id: '0193a1b2-0000-7000-8000-0000000000b7',
          key: 'PLT-7',
          title: 'Cut reads over',
          path: '/work/issue/PLT-7',
          data: { status: { name: 'In review' } },
        }
      : null,
};
const queued: { name: string; payload: unknown; key: string | undefined }[] = [];
const jobs = {
  send: async (name: string, payload?: unknown, options?: { idempotencyKey?: string }) => {
    queued.push({ name, payload, key: options?.idempotencyKey });
    return `job-${queued.length}`;
  },
};

const text = (value: string) => ({ type: 'text', text: value });
const para = (...content: unknown[]) => ({ type: 'paragraph', content });
const cell = (type: 'tableHeader' | 'tableCell', value: string) => ({
  type,
  content: [para(text(value))],
});
const body = (...blocks: unknown[]) => ({ type: 'doc', content: blocks }) as RichText;

async function readPdf(bytes: Buffer) {
  const pdf = await getDocument({ data: new Uint8Array(bytes) }).promise;
  let content = '';
  let images = 0;
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const found = await page.getTextContent();
    content += found.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n';
    const ops = await page.getOperatorList();
    images += ops.fnArray.filter((fn) => fn === OPS.paintImageXObject).length;
  }
  return { pages: pdf.numPages, text: content.replace(/\s+/g, ' '), images };
}

describe('PDF export through the renderer', () => {
  let harness: DocsHarness | null = null;
  let renderer: TestPdfRenderer | null = null;
  let http: DocsHttp;
  let skipReason = '';

  beforeAll(async () => {
    renderer = await startTestPdfRenderer('https://bemmoly.example.test');
    if (!renderer.available) {
      skipReason = renderer.reason;
      return;
    }
    const started = await startDocsHarness({ entities, jobs, files, pdf: renderer.renderer });
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    http = await startDocsHttp(harness);
  }, 300_000);

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
    if (renderer?.available) await renderer.stop();
  });

  it('renders a page and its subtree with images, a table, code and contents', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const member = as(users.member);
    const space = await harness.space('PDF');
    const root = await services.pages.create(member, { spaceId: space.id, title: 'Cutover plan' });
    const child = await services.pages.create(member, {
      spaceId: space.id,
      parentId: root.id,
      title: 'Rollback steps',
    });
    await services.pages.update(member, root.id, {
      snapshot: body(
        { type: 'heading', attrs: { level: 2 }, content: [text('Owners')] },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [cell('tableHeader', 'Step'), cell('tableHeader', 'Owner')],
            },
            {
              type: 'tableRow',
              content: [cell('tableCell', 'Backfill'), cell('tableCell', 'Aisha')],
            },
          ],
        },
        { type: 'image', attrs: { src: `/api/v1/files/${IMAGE_ID}`, alt: 'Cutover flow' } },
        { type: 'image', attrs: { src: `/api/v1/files/${HIDDEN_ID}`, alt: 'Hidden' } },
        { type: 'image', attrs: { src: 'https://tracker.example.org/pixel.png', alt: 'Remote' } },
        {
          type: 'codeBlock',
          attrs: { language: 'go' },
          content: [text('const ttl = 30 * time.Minute')],
        },
        { type: 'issueCard', attrs: { key: 'PLT-7' } },
      ),
    });
    await services.pages.update(member, child.id, {
      snapshot: body(para(text('Flip the flag back.'))),
    });

    const first = await http.call('POST', `/pages/${root.id}/exports`, {
      as: users.admin,
      body: { scope: 'subtree', paper: 'letter' },
    });
    expect(first.statusCode).toBe(202);
    const created = first.json() as PdfExport;
    expect(created.status).toBe('queued');
    const again = await http.call('POST', `/pages/${root.id}/exports`, {
      as: users.admin,
      body: { scope: 'subtree', paper: 'letter' },
    });
    expect((again.json() as PdfExport).id).toBe(created.id);
    expect(queued.filter((job) => job.name === 'docs.export-pdf')).toHaveLength(1);
    expect(queued[0]!.key).toBe(`docs.export-pdf:${created.id}`);

    await services.pdfExport.runQueued(created.id);
    const ready = (await http.call('GET', `/exports/${created.id}`, { as: users.admin })).json();
    expect(ready).toMatchObject({ status: 'ready', pages: 2, fileName: 'cutover-plan.pdf' });
    expect(
      (await http.call('GET', `/exports/${created.id}`, { as: users.viewer })).statusCode,
    ).toBe(404);

    const file = await http.call('GET', `/exports/${created.id}/file`, { as: users.admin });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    const pdf = await readPdf(file.rawPayload);
    expect(pdf.pages).toBe(3);
    expect(pdf.text).toContain('Contents');
    expect(pdf.text).toContain('Cutover plan');
    expect(pdf.text).toContain('Rollback steps');
    expect(pdf.text).toContain('Owner');
    expect(pdf.text).toContain('Aisha');
    // The image the person may not read and the one on another site print their alt text.
    expect(pdf.text).toContain('Hidden');
    expect(pdf.text).toContain('Remote');
    expect(pdf.text).toContain('const ttl = 30 * time.Minute');
    expect(pdf.text).toContain('Cut reads over');
    expect(pdf.text).toContain('In review');
    expect(pdf.text).toMatch(/1 ?\/ ?3/);
    expect(pdf.images).toBe(1);
  });

  it('prints one page on A4 without a contents list', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('PDF1');
    const page = await services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'One pager',
    });
    const created = await services.pdfExport.request(as(users.member), page.id, {
      scope: 'page',
      paper: 'a4',
    });
    await services.pdfExport.runQueued(created.id);
    const file = await services.pdfExport.file(as(users.member), created.id);
    const pdf = await readPdf(file.body);
    expect(pdf.pages).toBe(1);
    expect(pdf.text).toContain('One pager');
    expect(pdf.text).not.toContain('Contents');
  });
});
