// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PAGE_ID } from '../testing/doc-fixture.ts';
import { AISHA } from '../testing/fixture.ts';
import { CONFLUENCE_RFC } from './fixtures/confluence-rfc.xhtml.ts';
import { fromConfluence } from './from-confluence.ts';
import { plainText } from './text.ts';
import { toMarkdown } from './to-markdown.ts';

const resolved = () =>
  fromConfluence(CONFLUENCE_RFC, {
    resolvePage: (title, space) =>
      title === 'Sep 29 outage' && space === 'ENG' ? { pageId: PAGE_ID, title: 'Sep 29' } : null,
    resolveUser: (account) =>
      account === '557058:aisha' ? { id: AISHA, label: 'Aisha K.' } : null,
    resolveAttachment: (file) => `/files/${file}`,
  });

describe('Confluence import', () => {
  it('maps the storage format onto the schema, node by node', () => {
    expect((resolved().content ?? []).map((node) => node.type)).toEqual([
      'toc',
      'callout',
      'heading',
      'paragraph',
      'heading',
      'orderedList',
      'taskList',
      'issueTable',
      'table',
      'codeBlock',
      'callout',
      'paragraph',
      'image',
      'unsupportedBlock',
      'paragraph',
      'horizontalRule',
    ]);
  });

  it('reads as the same page in Markdown', () => {
    expect(toMarkdown(resolved())).toMatchInlineSnapshot(`
      "- [Context](#context)
        - [Migration order](#migration-order)

      > [!INFO]
      > **TL;DR**
      >
      > Move sessions to Postgres behind a flag.

      # Context

      Sessions live in **Redis** with _no_ durability. See [[Sep 29]] and ask @Aisha K..

      ## Migration order

      1. Dual-write sessions PLT-204
      2. Switch reads behind \`auth_pg_sessions\`

      - [x] Backfill
      - [ ] Cut reads

      \`\`\`lql
      project = PLT AND status != Done
      \`\`\`

      | Step | Owner |
      | --- | --- |
      | Backfill | Aisha |

      \`\`\`go
      const ttl = 30 * time.Minute
      if a < b && c > d {}
      \`\`\`

      > [!WARNING]
      > Keep Redis warm for [7 days](https://example.org/runbook).

      Flow:

      ![Cutover flow](/files/flow.png)

      > Confluence macro: jira-chart (not imported)

      Bad link

      ---
      "
    `);
  });

  it('keeps an unknown macro as a labelled block with its source', () => {
    const block = (resolved().content ?? []).find((node) => node.type === 'unsupportedBlock');
    expect(block?.attrs?.['source']).toBe('confluence');
    expect(block?.attrs?.['name']).toBe('jira-chart');
    expect(String(block?.attrs?.['raw'])).toContain('project = PLT');
  });

  it('prints links to pages and people as text when the importer cannot resolve them', () => {
    const doc = fromConfluence(CONFLUENCE_RFC);
    const text = plainText(doc);
    expect(text).toContain('See the postmortem and ask @someone.');
    expect(JSON.stringify(doc)).not.toContain('pageLink');
    expect(text).toContain('Flow: Cutover flow');
  });

  it('drops scripts and unsafe links but keeps their text', () => {
    const json = JSON.stringify(resolved());
    expect(json).not.toContain('javascript:');
    expect(json).not.toContain('<script');
    expect(plainText(resolved())).toContain('Bad link');
  });

  it('reads an empty page as one empty paragraph', () => {
    expect(fromConfluence('  ')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });
});
