// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { EVERY_DOC_NODE, PAGE_ID } from '../testing/doc-fixture.ts';
import { AISHA, EVERY_NODE } from '../testing/fixture.ts';
import type { RichTextDoc } from '../types.ts';
import { buildToc, collectReferences, headingIds, plainText, slugify, wordCount } from './text.ts';

const heading = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});

describe('plain text', () => {
  it('prints one line per block, with what each Docs node holds', () => {
    const text = plainText(EVERY_DOC_NODE);
    expect(text.split('\n')).toEqual([
      'Move sessions from Redis to Postgres behind a flag; dual-write, cut reads.',
      'Context',
      'Sessions live in Redis. See Postmortem: Sep 29 login outage and ask @Aisha K..',
      'Migration order',
      'Dual-write sessions PLT-204',
      'Open work',
      'PLT-204',
      'Owners',
      'Step Owner',
      'Backfill Aisha',
      'Flag TTL is 30 minutes.',
      'const ttl = 30 * time.Minute',
      'Cutover flow',
    ]);
  });

  it('reads the base set as the server did before', () => {
    const text = plainText(EVERY_NODE);
    expect(text).toContain('Move sessions to Postgres behind auth_pg_sessions, not Redis.');
    expect(text).toContain('@Aisha K. see PLT-204 and the runbook\nThen cut over.');
  });

  it('is empty for nothing', () => {
    expect(plainText(null)).toBe('');
    expect(plainText({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('');
  });

  it('counts words', () => {
    expect(wordCount(EVERY_DOC_NODE)).toBe(53);
    expect(wordCount({ type: 'paragraph', content: [{ type: 'text', text: ' a  b\tc ' }] })).toBe(
      3,
    );
    expect(wordCount(null)).toBe(0);
  });
});

describe('references', () => {
  it('collects pages, people, issues and queries once, in order', () => {
    const doubled: RichTextDoc = {
      type: 'doc',
      content: [...(EVERY_DOC_NODE.content ?? []), ...(EVERY_DOC_NODE.content ?? [])],
    };
    expect(collectReferences(doubled)).toEqual([
      { kind: 'page', id: PAGE_ID },
      { kind: 'user', id: AISHA },
      { kind: 'issue', key: 'PLT-204' },
      { kind: 'issueQuery', query: 'project = PLT AND status != Done' },
    ]);
  });

  it('skips nodes with nothing to point at', () => {
    const doc: RichTextDoc = {
      type: 'doc',
      content: [
        { type: 'issueTable', attrs: { query: '  ', title: '' } },
        { type: 'paragraph', content: [{ type: 'pageLink', attrs: { pageId: '', title: 'x' } }] },
      ],
    };
    expect(collectReferences(doc)).toEqual([]);
  });
});

describe('table of contents', () => {
  const doc: RichTextDoc = {
    type: 'doc',
    content: [
      heading(1, 'Auth service RFC'),
      heading(2, 'Context'),
      heading(3, 'Why now?'),
      heading(2, 'Context'),
      heading(3, 'Déjà vu'),
      { type: 'heading', attrs: { level: 2 } },
    ],
  };

  it('lists headings to the depth asked, with unique anchors', () => {
    expect(buildToc(doc, 2)).toEqual([
      { level: 1, text: 'Auth service RFC', id: 'auth-service-rfc' },
      { level: 2, text: 'Context', id: 'context' },
      { level: 2, text: 'Context', id: 'context-2' },
    ]);
    expect(buildToc(doc).map((entry) => entry.id)).toContain('deja-vu');
  });

  it('gives every heading the anchor the toc links to', () => {
    expect(headingIds(doc)).toEqual([
      'auth-service-rfc',
      'context',
      'why-now',
      'context-2',
      'deja-vu',
      'section',
    ]);
    expect(slugify('  ')).toBe('section');
  });
});
