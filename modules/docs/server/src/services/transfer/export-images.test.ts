import { Readable } from 'node:stream';
import type { RequestContext } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import type { RichText } from '../../../../shared/common.ts';
import { renderExport } from './export.ts';

const MINE = '0199c0de-0000-7000-8000-0000000000f1';
const HIDDEN = '0199c0de-0000-7000-8000-0000000000f2';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ctx = {} as RequestContext;

const files = {
  async read(_ctx: RequestContext, id: string) {
    if (id !== MINE) throw new NotFoundError('The file was not found');
    return { name: 'flow.png', mime: 'image/png', size: PNG.length, body: Readable.from([PNG]) };
  },
};

const withImages = (...ids: string[]) =>
  ({
    type: 'doc',
    content: ids.map((id) => ({ type: 'image', attrs: { src: `/api/v1/files/${id}`, alt: id } })),
  }) as unknown as RichText;

const page = (id: string, parent: string | null, snapshot: RichText) => ({
  id,
  parent_id: parent,
  title: id,
  snapshot,
});

describe('uploaded images in exports', () => {
  it('embeds them in a self-contained HTML page, keeping what the person may not read', async () => {
    const file = await renderExport({ files }, ctx, [page('Plan', null, withImages(MINE, HIDDEN))], {
      format: 'html',
      scope: 'page',
    });
    const html = String(file.body);
    expect(html).toContain(`src="data:image/png;base64,${PNG.toString('base64')}"`);
    expect(html).toContain(`src="/api/v1/files/${HIDDEN}"`);
  });

  it('keeps the in-app path in a single Markdown file', async () => {
    const file = await renderExport({ files }, ctx, [page('Plan', null, withImages(MINE))], {
      format: 'markdown',
      scope: 'page',
    });
    expect(String(file.body)).toContain(`![${MINE}](/api/v1/files/${MINE})`);
  });

  it('puts them in the folder export beside the pages', async () => {
    const file = await renderExport(
      { files },
      ctx,
      [page('Plan', null, withImages()), page('Child', 'Plan', withImages(MINE))],
      { format: 'markdown', scope: 'subtree' },
    );
    expect(file.contentType).toBe('application/zip');
    expect((file.body as Buffer).includes(`images/${MINE}.png`)).toBe(true);
  });
});
