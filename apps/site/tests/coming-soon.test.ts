/**
 * "Coming soon" comes from one place (ROADMAP in src/data/changelog.ts) and is checked against
 * the release notes, so a shipped feature cannot stay listed as coming (run `pnpm build`
 * first): no roadmap row is in a release note yet, every shipped item is in the notes of the
 * release that brought it, and no page puts a shipped item next to a "Coming soon" badge,
 * heading or sentence.
 */
import { readdirSync, readFileSync } from 'node:fs';
import type { HtmlElement } from 'html-validate';
import { describe, expect, it } from 'vitest';
import { ROADMAP, SHIPPED, SHIPPED_ALIASES } from '../src/data/changelog.ts';
import { NOTED_RELEASES, UPCOMING } from '../src/lib/changelog.ts';
import { isSitePage, parsePage } from './dom.ts';

const dist = new URL('../dist/', import.meta.url);
const pages = readdirSync(dist, { recursive: true, encoding: 'utf8' }).filter(isSitePage);
const llms = readFileSync(new URL('llms.txt', dist), 'utf8');

const notesOf = (version: string) =>
  NOTED_RELEASES.find((release) => release.version === version)
    ?.changes.flatMap((change) => change.paragraphs)
    .join('\n') ?? '';
const allNotes = NOTED_RELEASES.map((release) => notesOf(release.version)).join('\n');

const escape = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termPattern = (term: string) => new RegExp(`\\b${escape(term)}`, 'i');
const shippedTerms = [...SHIPPED.flatMap((item) => item.terms), ...SHIPPED_ALIASES];

const SOON = /coming soon/i;
const text = (element: HtmlElement) => element.textContent.replace(/\s+/g, ' ').trim();

/** The card, row or section a "Coming soon" label belongs to: its nearest wider ancestor. */
function contextOf(label: HtmlElement): string {
  let node: HtmlElement | null = label;
  while (node && text(node).length < 40) node = node.parent;
  return node ? text(node) : '';
}

/** Every piece of a page that says "Coming soon", as the text a reader sees around it. */
function soonContexts(page: HtmlElement, file: string): string[] {
  const labels = page
    .querySelectorAll('*')
    .filter((element) => /^coming soon$/i.test(text(element)));
  // Release notes on /changelog quote history; its own "Coming soon" section is a label.
  if (file === 'changelog.html') return labels.map(contextOf);
  const sentences = page
    .querySelectorAll('p, li')
    .filter((element) => SOON.test(text(element)) && !/^coming soon$/i.test(text(element)))
    .flatMap((element) =>
      text(element)
        .split(/(?<=[.;])\s+/)
        .filter((part) => SOON.test(part)),
    );
  return [...labels.map(contextOf), ...sentences];
}

describe('coming soon', () => {
  it('is one list, the one the changelog and llms.txt render', () => {
    expect(UPCOMING).toBe(ROADMAP);
    for (const row of ROADMAP) expect(llms).toContain(`- ${row.title}: ${row.scope}.`);
  });

  it.each(ROADMAP.map((row) => [row.title, row] as const))(
    '%s is in no release note yet',
    (_title, row) => {
      for (const term of row.terms) expect(allNotes).not.toMatch(termPattern(term));
    },
  );

  it.each(SHIPPED.map((item) => [item.title, item] as const))(
    '%s is in its release notes and off the roadmap',
    (_title, item) => {
      const notes = notesOf(item.since);
      expect(notes, `no notes for ${item.since}`).not.toBe('');
      expect(item.terms.some((term) => termPattern(term).test(notes))).toBe(true);
      for (const row of ROADMAP) {
        for (const term of item.terms) {
          expect(`${row.title} ${row.scope}`).not.toMatch(termPattern(term));
        }
      }
    },
  );

  it('reads the "Coming soon" contexts of the pages', () => {
    const changelog = parsePage(readFileSync(new URL('changelog.html', dist), 'utf8'));
    expect(soonContexts(changelog, 'changelog.html').length).toBeGreaterThan(0);
  });

  it.each(pages)('%s lists nothing shipped as coming soon', (file) => {
    const page = parsePage(
      readFileSync(new URL(file, dist), 'utf8').replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ''),
    );
    for (const context of soonContexts(page, file)) {
      for (const term of shippedTerms) {
        expect(context, `${file}: "${term}" beside Coming soon`).not.toMatch(termPattern(term));
      }
    }
  });

  it('llms.txt lists nothing shipped under Coming soon', () => {
    const soon = llms.split('## Coming soon')[1]?.split('\n## ')[0] ?? '';
    expect(soon).not.toBe('');
    for (const term of shippedTerms) expect(soon).not.toMatch(termPattern(term));
  });
});
