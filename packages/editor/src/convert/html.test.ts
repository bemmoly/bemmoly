// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { EVERY_DOC_NODE } from '../testing/doc-fixture.ts';
import { EVERY_NODE } from '../testing/fixture.ts';
import type { RichTextDoc } from '../types.ts';
import { toHtml, toHtmlDocument } from './to-html.ts';

const para = (text: string, marks?: Array<{ type: string; attrs?: Record<string, unknown> }>) => ({
  type: 'paragraph',
  content: [{ type: 'text', text, ...(marks ? { marks } : {}) }],
});

describe('HTML export', () => {
  it('prints every Docs node', () => {
    expect(
      toHtml(EVERY_DOC_NODE, { issueHref: (key) => `/work/issue/${key}` }),
    ).toMatchInlineSnapshot(
      `"<nav class="toc"><ul><li class="toc-2"><a href="#context">Context</a></li><li class="toc-2"><a href="#migration-order">Migration order</a></li><li class="toc-3"><a href="#owners">Owners</a></li></ul></nav><aside class="callout callout-info" data-type="callout" data-variant="info"><p>Move sessions from Redis to Postgres behind a flag; dual-write, cut reads.</p></aside><h2 id="context">Context</h2><p>Sessions live in Redis. See <span class="page-link">Postmortem: Sep 29 login outage</span> and ask <span class="mention" data-type="mention">@Aisha K.</span>.</p><h2 id="migration-order">Migration order</h2><ol><li><p>Dual-write sessions <a class="issue" href="/work/issue/PLT-204">PLT-204</a></p></li></ol><div class="issue-table" data-type="issueTable"><p><strong>Open work</strong></p><pre><code>project = PLT AND status != Done</code></pre></div><p class="issue-card"><a href="/work/issue/PLT-204">PLT-204</a></p><h3 id="owners">Owners</h3><table><tbody><tr><th><p>Step</p></th><th><p>Owner</p></th></tr><tr><td><p>Backfill</p></td><td><p>Aisha</p></td></tr></tbody></table><section class="decision" data-type="decision" data-state="decided"><p class="decision-label">Decision: Decided · 2026-10-07</p><p>Flag TTL is 30 minutes.</p></section><pre><code class="language-go">const ttl = 30 * time.Minute</code></pre><figure><img src="https://example.org/flow.png" alt="Cutover flow" loading="lazy"></figure><div class="unsupported" data-type="unsupportedBlock">Confluence macro: jira-chart (not imported)</div><p></p>"`,
    );
  });

  it('prints the base set', () => {
    expect(toHtml(EVERY_NODE)).toMatchInlineSnapshot(`
      "<h2 id="context">Context</h2><p>Move <strong>sessions</strong> to <em>Postgres</em> behind <code>auth_pg_sessions</code>, not <s>Redis</s>.</p><p><span class="mention" data-type="mention">@Aisha K.</span> see <a href="/work/issue/PLT-204" rel="noopener noreferrer nofollow">PLT-204</a> and <a href="https://example.org/runbook" rel="noopener noreferrer nofollow">the runbook</a><br>Then cut over.</p><ul><li><p>Zero session loss</p></li><li><p>p95 read under 8 ms</p></li></ul><ol><li><p>Dual-write</p></li></ol><ul class="tasks"><li><input type="checkbox" disabled checked> <p>Backfill</p></li><li><input type="checkbox" disabled> <p>Cut reads</p></li></ul><blockquote><p>Keep Redis warm for 7 days.</p></blockquote><pre><code>SELECT 1;
      SELECT 2;</code></pre><hr><p></p>"
    `);
  });

  it('escapes text and drops unsafe links, images and markup', () => {
    const doc: RichTextDoc = {
      type: 'doc',
      content: [
        para('<script>alert(1)</script> & "quotes"'),
        para('click', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
        para('ok', [{ type: 'link', attrs: { href: 'https://example.org/?a=1&b="2"' } }]),
        {
          type: 'image',
          attrs: { src: 'data:text/html;base64,PHNjcmlwdD4=', alt: 'x" onerror="y' },
        },
        { type: 'callout', attrs: { variant: '"><script>' }, content: [para('c')] },
        {
          type: 'pageLink',
          attrs: { pageId: 'p1', title: '<img src=x onerror=alert(1)>' },
        },
      ],
    };
    const html = toHtml(doc, { pageHref: () => 'javascript:void(0)" onclick="x' });
    expect(html).not.toMatch(/<script|<img src=x|javascript:|onerror="/);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;');
    expect(html).toContain('<p>click</p>');
    expect(html).toContain('href="https://example.org/?a=1&amp;b=&quot;2&quot;"');
    expect(html).toContain('data-variant="info"');
  });

  it('follows a host link to a file beside the export, and nothing protocol-relative', () => {
    const doc: RichTextDoc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'pageLink', attrs: { pageId: 'p1', title: 'A' } }] },
      ],
    };
    expect(toHtml(doc, { pageHref: () => '../runbook/deploy.html' })).toContain(
      'href="../runbook/deploy.html"',
    );
    expect(toHtml(doc, { pageHref: () => './a.html' })).toContain('href="./a.html"');
    expect(toHtml(doc, { pageHref: () => './/evil.example' })).not.toContain('evil');
  });

  it('wraps a whole file with the title and an inline stylesheet, nothing fetched', () => {
    const file = toHtmlDocument(EVERY_DOC_NODE, 'Auth service <RFC>');
    expect(file.startsWith('<!doctype html>')).toBe(true);
    expect(file).toContain('<title>Auth service &lt;RFC&gt;</title>');
    expect(file).toContain('<h1>Auth service &lt;RFC&gt;</h1>');
    expect(file).toMatch(/<style>[^<]+<\/style>/);
    expect(file).not.toMatch(/<link|<script|@import|url\(/);
  });

  it('anchors top-level headings for the table of contents', () => {
    const html = toHtml(EVERY_DOC_NODE);
    expect(html).toContain('<h2 id="context">Context</h2>');
    expect(html).toContain('<a href="#owners">Owners</a>');
  });
});
