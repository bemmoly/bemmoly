import type { RichTextDoc, RichTextNode } from '../types.ts';
import { AISHA } from './fixture.ts';

export const PAGE_ID = '0199c0de-0000-7000-8000-0000000000a1';

const text = (value: string, marks?: RichTextNode['marks']): RichTextNode => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});
const paragraph = (...content: RichTextNode[]): RichTextNode =>
  content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
const heading = (level: number, value: string): RichTextNode => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});
const cell = (type: 'tableHeader' | 'tableCell', value: string): RichTextNode => ({
  type,
  attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
  content: [paragraph(...(value ? [text(value)] : []))],
});

/** Every registered Docs node, in the JSON shape the editor writes: the Auth service RFC. */
export const EVERY_DOC_NODE: RichTextDoc = {
  type: 'doc',
  content: [
    { type: 'toc', attrs: { maxLevel: 3 } },
    {
      type: 'callout',
      attrs: { variant: 'info' },
      content: [
        paragraph(
          text('Move sessions from Redis to Postgres behind a flag; dual-write, cut reads.'),
        ),
      ],
    },
    heading(2, 'Context'),
    paragraph(
      text('Sessions live in Redis. See '),
      { type: 'pageLink', attrs: { pageId: PAGE_ID, title: 'Postmortem: Sep 29 login outage' } },
      text(' and ask '),
      { type: 'mention', attrs: { id: AISHA, label: 'Aisha K.', mentionSuggestionChar: '@' } },
      text('.'),
    ),
    heading(2, 'Migration order'),
    {
      type: 'orderedList',
      attrs: { start: 1, type: null },
      content: [
        {
          type: 'listItem',
          content: [
            paragraph(text('Dual-write sessions '), {
              type: 'issueEmbed',
              attrs: { key: 'PLT-204' },
            }),
          ],
        },
      ],
    },
    {
      type: 'issueTable',
      attrs: { query: 'project = PLT AND status != Done', title: 'Open work' },
    },
    heading(3, 'Owners'),
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [cell('tableHeader', 'Step'), cell('tableHeader', 'Owner')] },
        { type: 'tableRow', content: [cell('tableCell', 'Backfill'), cell('tableCell', 'Aisha')] },
      ],
    },
    {
      type: 'decision',
      attrs: { state: 'decided', decidedOn: '2026-10-07' },
      content: [paragraph(text('Flag TTL is 30 minutes.'))],
    },
    {
      type: 'codeBlock',
      attrs: { language: 'go' },
      content: [text('const ttl = 30 * time.Minute')],
    },
    {
      type: 'image',
      attrs: { src: 'https://example.org/flow.png', alt: 'Cutover flow', title: null },
    },
    {
      type: 'unsupportedBlock',
      attrs: { source: 'confluence', name: 'jira-chart', raw: '<ac:structured-macro/>' },
    },
    paragraph(),
  ],
};
