import { describe, expect, it } from 'vitest';
import { fromAdf } from './from-adf.ts';
import { fromJiraWiki } from './from-jira-wiki.ts';
import { plainText } from './text.ts';
import { toMarkdown } from './to-markdown.ts';

const doc = (...content: unknown[]) => ({ type: 'doc', version: 1, content });
const p = (...content: unknown[]) => ({ type: 'paragraph', content });
const t = (text: string, marks?: unknown[]) => ({
  type: 'text',
  text,
  ...(marks ? { marks } : {}),
});

describe('fromAdf', () => {
  it('maps text, marks, headings, lists, code, panels and tables', () => {
    const result = fromAdf(
      doc(
        { type: 'heading', attrs: { level: 2 }, content: [t('Steps')] },
        p(
          t('Bold', [{ type: 'strong' }]),
          t(' and '),
          t('link', [{ type: 'link', attrs: { href: 'https://example.test' } }]),
        ),
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [p(t('one'))] }],
        },
        { type: 'codeBlock', attrs: { language: 'ts' }, content: [t('const a = 1;')] },
        { type: 'panel', attrs: { panelType: 'error' }, content: [p(t('Careful'))] },
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [{ type: 'tableHeader', content: [p(t('A'))] }] },
            { type: 'tableRow', content: [{ type: 'tableCell', content: [p(t('1'))] }] },
          ],
        },
      ),
    );
    expect((result.content ?? []).map((node) => node.type)).toEqual([
      'heading',
      'paragraph',
      'bulletList',
      'codeBlock',
      'callout',
      'table',
    ]);
    expect(result.content?.[4]?.attrs?.['variant']).toBe('danger');
    expect(toMarkdown(result)).toContain('**Bold** and [link](https://example.test)');
  });

  it('resolves mentions and media through the importer, and keeps unknown nodes labelled', () => {
    const result = fromAdf(
      doc(
        p({ type: 'mention', attrs: { id: 'acc-1', text: '@Ada' } }, t(' and '), {
          type: 'mention',
          attrs: { id: 'acc-2', text: '@Grace' },
        }),
        {
          type: 'mediaSingle',
          content: [{ type: 'media', attrs: { id: 'm-1', alt: 'shot.png' } }],
        },
        { type: 'extension', attrs: { extensionKey: 'roadmap' } },
      ),
      {
        resolveUser: (id) => (id === 'acc-1' ? { id: 'user-1', label: 'Ada' } : null),
        resolveMedia: () => null,
      },
    );
    const text = plainText(result);
    expect(text).toContain('@Ada');
    expect(text).toContain('@Grace');
    expect(JSON.stringify(result)).toContain('"id":"user-1"');
    expect(text).toContain('[shot.png]');
    expect(result.content?.at(-1)).toMatchObject({
      type: 'unsupportedBlock',
      attrs: { source: 'jira', name: 'extension' },
    });
  });

  it('turns an issue card into a live embed when the importer knows the key', () => {
    const result = fromAdf(
      doc(p({ type: 'inlineCard', attrs: { url: 'https://acme.example.test/browse/OPS-7' } })),
      { resolveIssueKey: (url) => /browse\/([A-Z]+-\d+)/.exec(url)?.[1] ?? null },
    );
    expect(JSON.stringify(result)).toContain('"type":"issueEmbed","attrs":{"key":"OPS-7"}');
  });

  it('answers an empty document for anything that is not a document', () => {
    expect(fromAdf(null)).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(fromAdf('plain')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });
});

describe('fromJiraWiki', () => {
  it('maps the common markup', () => {
    const result = fromJiraWiki(
      [
        'h2. Summary',
        'Some *bold*, _italic_ and {{mono}} with [a link|https://example.test].',
        '',
        '* first',
        '** nested',
        '# numbered',
        '{code:java}',
        'int a = 1;',
        '{code}',
        'bq. quoted',
        '[~ada] was here',
      ].join('\n'),
      { resolveUser: (name) => (name === 'ada' ? { id: 'user-1', label: 'Ada' } : null) },
    );
    expect((result.content ?? []).map((node) => node.type)).toEqual([
      'heading',
      'paragraph',
      'bulletList',
      'orderedList',
      'codeBlock',
      'blockquote',
      'paragraph',
    ]);
    const markdown = toMarkdown(result);
    expect(markdown).toContain('**bold**');
    expect(markdown).toContain('[a link](https://example.test)');
    expect(markdown).toContain('int a = 1;');
    expect(JSON.stringify(result)).toContain('"id":"user-1"');
  });

  it('keeps an empty description valid', () => {
    expect(fromJiraWiki('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(fromJiraWiki(null)).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });
});
