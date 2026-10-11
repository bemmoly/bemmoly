import type { RichTextDoc, RichTextNode } from '../types.ts';

export const AISHA = '0199c0de-0000-7000-8000-000000000001';

type Mark = { type: string; attrs?: Record<string, unknown> };

const text = (value: string, marks?: Mark[]): RichTextNode => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});
const paragraph = (...content: RichTextNode[]): RichTextNode => ({ type: 'paragraph', content });
const link = (href: string): Mark => ({
  type: 'link',
  attrs: { href, target: null, rel: 'noopener noreferrer nofollow', class: null, title: null },
});

/** Every node and mark of the base schema, in the JSON shape the editor writes. */
export const EVERY_NODE: RichTextDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [text('Context')] },
    paragraph(
      text('Move '),
      text('sessions', [{ type: 'bold' }]),
      text(' to '),
      text('Postgres', [{ type: 'italic' }]),
      text(' behind '),
      text('auth_pg_sessions', [{ type: 'code' }]),
      text(', not '),
      text('Redis', [{ type: 'strike' }]),
      text('.'),
    ),
    paragraph(
      { type: 'mention', attrs: { id: AISHA, label: 'Aisha K.', mentionSuggestionChar: '@' } },
      text(' see '),
      text('PLT-204', [link('/work/issue/PLT-204')]),
      text(' and '),
      text('the runbook', [link('https://example.org/runbook')]),
      { type: 'hardBreak' },
      text('Then cut over.'),
    ),
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [paragraph(text('Zero session loss'))] },
        { type: 'listItem', content: [paragraph(text('p95 read under 8 ms'))] },
      ],
    },
    {
      type: 'orderedList',
      attrs: { start: 1, type: null },
      content: [{ type: 'listItem', content: [paragraph(text('Dual-write'))] }],
    },
    {
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: true }, content: [paragraph(text('Backfill'))] },
        { type: 'taskItem', attrs: { checked: false }, content: [paragraph(text('Cut reads'))] },
      ],
    },
    { type: 'blockquote', content: [paragraph(text('Keep Redis warm for 7 days.'))] },
    { type: 'codeBlock', attrs: { language: null }, content: [text('SELECT 1;\nSELECT 2;')] },
    { type: 'horizontalRule' },
    { type: 'paragraph' },
  ],
};
