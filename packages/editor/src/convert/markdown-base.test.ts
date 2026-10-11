import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { looksLikeMarkdown, plainMarkdown } from '../markdown-lines.ts';
import { baseExtensions } from '../schema/base.ts';
import { table } from '../schema/nodes/table.ts';
import type { RichTextDoc } from '../types.ts';
import { fromMarkdownBase } from './markdown-base.ts';

const lines = (...text: string[]): RichTextDoc => ({
  type: 'doc',
  content: text.map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] })),
});

const types = (doc: RichTextDoc) => (doc.content ?? []).map((node) => node.type);

describe('looksLikeMarkdown', () => {
  it('spots rules and table rows, and stays fast on long hostile lines', () => {
    expect(looksLikeMarkdown(['---'])).toBe(true);
    expect(looksLikeMarkdown(['| a | b |  '])).toBe(true);
    expect(looksLikeMarkdown(['just words'])).toBe(false);
    const started = performance.now();
    looksLikeMarkdown([
      `${'-'.repeat(50_000)}${' '.repeat(50_000)}x`,
      '['.repeat(50_000),
      `[a](${'('.repeat(50_000)}`,
    ]);
    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe('plainMarkdown', () => {
  it('reads Markdown typed into plain paragraphs back as one source', () => {
    const source = plainMarkdown(
      lines(
        '## Change',
        'Uses `randomUUID`:',
        '- one',
        '- two',
        '| a | b |',
        '| --- | --- |',
        '| 1 | 2 |',
        'After.',
      ),
    );
    expect(source).toBe(
      '## Change\n\nUses `randomUUID`:\n\n- one\n- two\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nAfter.',
    );
  });

  it('leaves prose and structured documents alone', () => {
    expect(plainMarkdown(lines('Just words.', 'More words.'))).toBeNull();
    expect(
      plainMarkdown({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '# x' }] },
        ],
      }),
    ).toBeNull();
    expect(plainMarkdown(null)).toBeNull();
  });
});

describe('fromMarkdownBase', () => {
  it('keeps tables and folds callouts into nodes the Work editor opens', () => {
    const doc = fromMarkdownBase(
      '## Hi\n\n| service | result |\n| --- | --- |\n| buyer | 606 pass |\n\n> [!NOTE]\n> yo\n\n#### Deep\n\ntext `c`',
    );
    expect(types(doc)).toEqual(['heading', 'table', 'blockquote', 'heading', 'paragraph']);
    expect(doc.content?.[3]?.attrs?.['level']).toBe(3);

    const editor = new Editor({
      element: null,
      extensions: [...baseExtensions(), ...table.extensions()],
      content: doc,
    });
    expect(editor.getJSON().content?.[1]?.type).toBe('table');
    expect(editor.getText()).toContain('606 pass');
    expect(editor.getText()).toContain('yo');
    editor.destroy();
  });
});
