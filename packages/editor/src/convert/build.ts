import type { RichTextNode } from '../types.ts';

/*
 * Small builders the importers share, writing JSON in exactly the shape the editor writes
 * (every attribute present), so an imported page and a typed one compare equal.
 */

export type Mark = NonNullable<RichTextNode['marks']>[number];

export const text = (value: string, marks: Mark[] = []): RichTextNode =>
  marks.length ? { type: 'text', text: value, marks } : { type: 'text', text: value };

export const paragraph = (content: RichTextNode[] = []): RichTextNode =>
  content.length ? { type: 'paragraph', content } : { type: 'paragraph' };

export const linkMark = (href: string): Mark => ({
  type: 'link',
  attrs: { href, target: null, rel: 'noopener noreferrer nofollow', class: null, title: null },
});

export const cell = (header: boolean, content: RichTextNode[]): RichTextNode => ({
  type: header ? 'tableHeader' : 'tableCell',
  attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
  content: content.length ? content : [paragraph()],
});

export const image = (src: string, alt: string, title: string | null = null): RichTextNode => ({
  type: 'image',
  attrs: { src, alt, title },
});

export const codeBlock = (code: string, language: string | null): RichTextNode => ({
  type: 'codeBlock',
  attrs: { language },
  ...(code ? { content: [text(code)] } : {}),
});

/** Merges neighbouring text nodes with the same marks, as ProseMirror would on load. */
export function normalizeInline(nodes: RichTextNode[]): RichTextNode[] {
  const out: RichTextNode[] = [];
  for (const node of nodes) {
    const last = out[out.length - 1];
    if (node.type === 'text' && !node.text) continue;
    if (
      last?.type === 'text' &&
      node.type === 'text' &&
      JSON.stringify(last.marks ?? []) === JSON.stringify(node.marks ?? [])
    ) {
      out[out.length - 1] = { ...last, text: `${last.text ?? ''}${node.text ?? ''}` };
    } else out.push(node);
  }
  return out;
}

/** Inline nodes may not stand alone in a block container: they go in a paragraph. */
export function wrapLoose(nodes: RichTextNode[], isInline: (node: RichTextNode) => boolean) {
  const out: RichTextNode[] = [];
  let run: RichTextNode[] = [];
  const flush = () => {
    const content = normalizeInline(run);
    if (content.length) out.push(paragraph(content));
    run = [];
  };
  for (const node of nodes) {
    if (isInline(node)) run.push(node);
    else {
      flush();
      out.push(node);
    }
  }
  flush();
  return out;
}
