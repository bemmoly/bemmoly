// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { EVERY_DOC_NODE } from '../testing/doc-fixture.ts';
import { EVERY_NODE } from '../testing/fixture.ts';
import type { RichTextDoc } from '../types.ts';
import { fromMarkdown, htmlText } from './from-markdown.ts';
import { toMarkdown } from './to-markdown.ts';

/**
 * The fixtures without what Markdown has no way to hold: ids behind links and mentions, a
 * toc (printed as its links), an unsupported block and a trailing empty paragraph.
 */
const portable = (doc: RichTextDoc): RichTextDoc => ({
  type: 'doc',
  content: (doc.content ?? []).filter(
    (node) =>
      !['toc', 'unsupportedBlock'].includes(node.type) &&
      !(node.type === 'paragraph' && !node.content) &&
      !JSON.stringify(node).match(/"(mention|pageLink|issueEmbed|issueCard|hardBreak)"/),
  ),
});

describe('Markdown export', () => {
  it('prints every Docs node', () => {
    const markdown = toMarkdown(EVERY_DOC_NODE, {
      pageHref: (id) => `https://bemmoly.example/docs/p/${id}`,
      issueHref: (key) => `https://bemmoly.example/work/issue/${key}`,
    });
    expect(markdown).toMatchInlineSnapshot(`
      "- [Context](#context)
      - [Migration order](#migration-order)
        - [Owners](#owners)

      > [!INFO]
      > Move sessions from Redis to Postgres behind a flag; dual-write, cut reads.

      ## Context

      Sessions live in Redis. See [Postmortem: Sep 29 login outage](https://bemmoly.example/docs/p/0199c0de-0000-7000-8000-0000000000a1) and ask @Aisha K..

      ## Migration order

      1. Dual-write sessions [PLT-204](https://bemmoly.example/work/issue/PLT-204)

      \`\`\`lql title="Open work"
      project = PLT AND status != Done
      \`\`\`

      [PLT-204](https://bemmoly.example/work/issue/PLT-204)

      ### Owners

      | Step | Owner |
      | --- | --- |
      | Backfill | Aisha |

      > **Decision: Decided · 2026-10-07**
      >
      > Flag TTL is 30 minutes.

      \`\`\`go
      const ttl = 30 * time.Minute
      \`\`\`

      ![Cutover flow](https://example.org/flow.png)

      > Confluence macro: jira-chart (not imported)
      "
    `);
  });

  it('escapes text that would read as syntax', () => {
    const doc: RichTextDoc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '# not a heading *or* [link]' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '1. not a list' }] },
      ],
    };
    const markdown = toMarkdown(doc);
    expect(markdown).toBe('\\# not a heading \\*or\\* \\[link\\]\n\n1\\. not a list\n');
    expect(fromMarkdown(markdown)).toEqual(doc);
  });

  it('prints nothing for an empty document', () => {
    expect(toMarkdown(null)).toBe('');
  });
});

describe('Markdown round trip', () => {
  it.each([
    ['the base set', portable(EVERY_NODE)],
    ['the Docs nodes', portable(EVERY_DOC_NODE)],
  ])('reads back %s unchanged', (_name, doc) => {
    expect(fromMarkdown(toMarkdown(doc))).toEqual(doc);
  });

  it('reads back a callout of every variant and every decision state', () => {
    const paragraph = { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] };
    const doc: RichTextDoc = {
      type: 'doc',
      content: [
        ...['info', 'note', 'success', 'warning', 'danger'].map((variant) => ({
          type: 'callout',
          attrs: { variant },
          content: [paragraph],
        })),
        { type: 'decision', attrs: { state: 'proposed', decidedOn: null }, content: [paragraph] },
        { type: 'decision', attrs: { state: 'superseded', decidedOn: null }, content: [paragraph] },
      ],
    };
    expect(fromMarkdown(toMarkdown(doc))).toEqual(doc);
  });
});

describe('Markdown import', () => {
  it('reads GitHub alerts, nested task lists and loose HTML', () => {
    const doc = fromMarkdown(
      [
        '> [!TIP]',
        '> Use **dual-write**.',
        '',
        '- [x] Backfill',
        '- [ ] Cut reads',
        '',
        '<div>Raw <b>html</b></div>',
        '',
        '#### Deep heading',
        '',
        'Text with ![inline](https://example.org/a.png) image and [bad](javascript:alert(1)).',
      ].join('\n'),
    );
    const types = (doc.content ?? []).map((node) => node.type);
    expect(types).toEqual([
      'callout',
      'taskList',
      'paragraph',
      'heading',
      'paragraph',
      'image',
      'paragraph',
    ]);
    expect(doc.content?.[0]?.attrs).toEqual({ variant: 'success' });
    expect(doc.content?.[3]?.attrs).toEqual({ level: 3 });
    expect(JSON.stringify(doc)).not.toContain('javascript:');
  });

  it('gives an empty input one empty paragraph', () => {
    expect(fromMarkdown('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });

  it('keeps only the words of raw HTML, even nested or entity-encoded tags', () => {
    expect(htmlText('<p>Hello <b>there</b></p>')).toBe('Hello there');
    expect(htmlText('<scr<script>ipt>alert(1)</script>')).toBe('alert(1)');
    expect(htmlText('&lt;script&gt;x&lt;/script&gt; ok')).toBe('x ok');
    expect(htmlText('a <img src=x onerror=y')).toBe('a img src=x onerror=y');
  });
});
