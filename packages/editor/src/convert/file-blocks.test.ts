import { describe, expect, it } from 'vitest';
import type { RichTextDoc } from '../types.ts';
import { asFileBlocks, imageSources } from './file-blocks.ts';
import { fromMarkdown } from './from-markdown.ts';
import { toHtml } from './to-html.ts';
import { toMarkdown } from './to-markdown.ts';

const REPORT = '/api/v1/files/0199c0de-0000-7000-8000-0000000000a1';
const SHOT = '/api/v1/files/0199c0de-0000-7000-8000-0000000000a2';

const page: RichTextDoc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Before.' }] },
    { type: 'file', attrs: { src: REPORT, name: 'Q3 report.html', mime: 'text/html' } },
    { type: 'paragraph', content: [{ type: 'text', text: 'After.' }] },
  ],
};

describe('File blocks in Markdown and HTML', () => {
  it('write image syntax that comes back as the same block once the host names the file', () => {
    const markdown = toMarkdown(page);
    expect(markdown).toContain(`![Q3 report.html](${REPORT})`);
    const read = fromMarkdown(markdown);
    expect(imageSources(read)).toEqual([REPORT]);
    const documents = new Map([[REPORT, { name: 'Q3 report.html', mime: 'text/html' }]]);
    expect(asFileBlocks(read, documents)).toEqual(page);
  });

  it('keeps images that are images, and names a file by its alt text when there is one', () => {
    const read = fromMarkdown(`![Diagram](${SHOT})\n\n![Spec](${REPORT})\n`);
    const documents = new Map([
      [SHOT, { name: 'diagram.png', mime: 'image/png' }],
      [REPORT, { name: 'spec.pdf', mime: 'application/pdf' }],
    ]);
    const types = asFileBlocks(read, documents).content!.map((node) => [node.type, node.attrs]);
    expect(types).toEqual([
      ['image', expect.objectContaining({ src: SHOT })],
      ['file', { src: REPORT, name: 'Spec', mime: 'application/pdf' }],
    ]);
  });

  it('prints a link in HTML, never the file itself', () => {
    const html = toHtml(page);
    expect(html).toContain(`<a href="${REPORT}">Q3 report.html</a>`);
    expect(html).not.toContain('<iframe');
  });
});
