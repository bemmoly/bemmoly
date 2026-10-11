// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { RichTextDoc } from '../types.ts';
import { toHtml } from './to-html.ts';
import { toMarkdown as print } from './to-markdown.ts';

const STORED = '/api/v1/files/0199c0de-0000-7000-8000-0000000000f1';
const doc = (src: string): RichTextDoc => ({
  type: 'doc',
  content: [{ type: 'image', attrs: { src, alt: 'Flow' } }],
});
const toMarkdown = (...args: Parameters<typeof print>) => print(...args).trim();
const PIXEL = 'data:image/png;base64,iVBORw0KGgo=';

describe('images in exports', () => {
  it('keeps the stored source when the host does not move it', () => {
    expect(toMarkdown(doc(STORED))).toBe(`![Flow](${STORED})`);
    expect(toHtml(doc(STORED))).toContain(`<img src="${STORED}" alt="Flow"`);
  });

  it('points at the file beside the export, or embeds it, as the host says', () => {
    const beside = { imageSrc: () => '../images/f1.png' };
    expect(toMarkdown(doc(STORED), beside)).toBe('![Flow](../images/f1.png)');
    expect(toHtml(doc(STORED), { imageSrc: () => PIXEL })).toContain(`<img src="${PIXEL}"`);
  });

  it('never lets the host swap in a source an export may not follow', () => {
    const unsafe = { imageSrc: () => 'javascript:alert(1)' };
    expect(toMarkdown(doc(STORED), unsafe)).toBe(`![Flow](${STORED})`);
    const svg = { imageSrc: () => 'data:image/svg+xml;base64,PHN2Zz4=' };
    expect(toHtml(doc(STORED), svg)).toContain(`<img src="${STORED}"`);
  });

  it('drops an unsafe stored source whatever the host says', () => {
    expect(toMarkdown(doc('javascript:alert(1)'), { imageSrc: () => PIXEL })).toBe('Flow');
  });
});
