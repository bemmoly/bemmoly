// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { EVERY_DOC_NODE } from '../testing/doc-fixture.ts';
import type { RichTextDoc } from '../types.ts';
import { toPrintDocument } from './to-print.ts';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const page = (id: string, title: string, doc: RichTextDoc | null, depth = 0) => ({
  id,
  title,
  doc,
  depth,
});

const linkTo = (pageId: string): RichTextDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'pageLink', attrs: { pageId, title: 'X' } }] }],
});

describe('print document', () => {
  it('prints one page with its title, the paper size and nothing to fetch', () => {
    const out = toPrintDocument('Auth <RFC>', [page('p1', 'Auth <RFC>', EVERY_DOC_NODE)], {
      paper: 'a4',
    });
    expect(out.html).toContain('<title>Auth &lt;RFC&gt;</title>');
    expect(out.html).toContain('<h1>Auth &lt;RFC&gt;</h1>');
    expect(out.html).toContain('@page{size:210mm 297mm');
    expect(out.html).not.toContain('class="contents"');
    expect(out.html).not.toMatch(/<link|<script|@import|url\(/);
  });

  it('prints on Letter', () => {
    const out = toPrintDocument('A', [page('p1', 'A', null)], { paper: 'letter' });
    expect(out.html).toContain('@page{size:8.5in 11in');
  });

  it('carries the title in the header and page numbers in the footer', () => {
    const out = toPrintDocument('Runbook & notes', [page('p1', 'R', null)], { paper: 'a4' });
    expect(out.headerHtml).toContain('Runbook &amp; notes');
    expect(out.footerHtml).toContain('<span class="pageNumber"></span>');
    expect(out.footerHtml).toContain('<span class="totalPages"></span>');
  });

  it('opens a subtree with its contents and starts each page on a new sheet', () => {
    const out = toPrintDocument(
      'Runbook',
      [page('p1', 'Runbook', linkTo('p2')), page('p2', 'Restore', linkTo('p9'), 1)],
      { paper: 'a4', pageHref: (id) => `https://bemmoly.test/docs/p/${id}` },
    );
    expect(out.html).toContain('<nav class="contents"><h1>Contents</h1>');
    expect(out.html).toContain('<li class="depth-1"><a href="#page-p2">Restore</a></li>');
    expect(out.html).toContain('<section class="page" id="page-p2">');
    expect(out.html).toContain('section.page+section.page{break-before:page}');
    expect(out.html).toContain('href="#page-p2"');
    expect(out.html).toContain('href="https://bemmoly.test/docs/p/p9"');
  });

  it('colours code, escaping every token', () => {
    const doc: RichTextDoc = {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [{ type: 'text', text: 'const a = "<b>";' }],
        },
      ],
    };
    const { html } = toPrintDocument('C', [page('p1', 'C', doc)], { paper: 'a4' });
    expect(html).toContain('<span class="hljs-keyword">const</span>');
    expect(html).toContain('<span class="hljs-string">&quot;&lt;b&gt;&quot;</span>');
    expect(html).not.toContain('"<b>"');
  });

  it('draws issue embeds as static chips with their title and status', () => {
    const { html } = toPrintDocument('I', [page('p1', 'I', EVERY_DOC_NODE)], {
      paper: 'a4',
      issueSummary: (key) =>
        key === 'PLT-204' ? { title: 'Dual-write <sessions>', status: 'In progress' } : null,
    });
    expect(html).toContain(
      'PLT-204 <span class="issue-title">Dual-write &lt;sessions&gt;</span> <span class="issue-status">In progress</span>',
    );
  });

  it('prints images the host embeds, tables and callouts', () => {
    const { html } = toPrintDocument('T', [page('p1', 'T', EVERY_DOC_NODE)], {
      paper: 'a4',
      imageSrc: () => PNG,
    });
    expect(html).toContain(`<img src="${PNG}"`);
    expect(html).toContain('<table>');
    expect(html).toContain('class="callout callout-info"');
  });

  it('prints the alt text of an image the host does not embed, never its address', () => {
    const { html } = toPrintDocument('T', [page('p1', 'T', EVERY_DOC_NODE)], {
      paper: 'a4',
      imageSrc: () => false,
    });
    expect(html).toContain('<p class="image-alt">Cutover flow</p>');
    expect(html).not.toContain('example.org/flow.png');
  });
});
