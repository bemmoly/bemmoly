/**
 * The site's honesty rules, read from the built pages and text files (run `pnpm build`
 * first): a feature is either shipped and verified, or "Coming soon" with no date or version.
 * Nothing is "untested" or "planned", AI (shipped in 0.5) is never described as coming, every
 * Install call to action lands on the one install page, and the old install guide is gone.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INSTALL_HREF } from '../src/lib/links.ts';
import { isSitePage, parsePage } from './dom.ts';

const dist = new URL('../dist/', import.meta.url);
const files = readdirSync(dist, { recursive: true, encoding: 'utf8' }).filter(
  (file) => isSitePage(file) || /^(llms\.txt|changelog\.xml)$/.test(file),
);
/** The words a visitor or a crawler reads: the body text, plus head metadata and alt text. */
function wordsOf(file: string): string {
  const source = readFileSync(new URL(file, dist), 'utf8');
  if (!file.endsWith('.html')) return source;
  const page = parsePage(source.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ''));
  const attributes = page
    .querySelectorAll('[alt], [content], [aria-label], [title]')
    .flatMap((element) =>
      ['alt', 'content', 'aria-label', 'title'].map((name) => element.getAttribute(name)?.value),
    )
    .filter((value): value is string => typeof value === 'string');
  return [page.textContent, ...attributes].join('\n').replace(/\s+/g, ' ');
}
const words = Object.fromEntries(files.map((file) => [file, wordsOf(file)]));
/** Release notes quote history (an old note may say "planned"); they are not the site's claims. */
const claims = (file: string) => file !== 'changelog.xml' && file !== 'changelog.html';

describe('claims', () => {
  it('reads every page', () => {
    expect(files).toContain('index.html');
    expect(files).toContain('self-hosting.html');
    expect(files).toContain('llms.txt');
  });

  it.each(files.filter(claims))('%s claims nothing untested or merely planned', (file) => {
    expect(words[file]).not.toMatch(/\buntested\b|not yet tested|tested end to end/i);
    expect(words[file]).not.toMatch(/\bplanned\b|on the roadmap|still to come/i);
    expect(words[file]).not.toMatch(/air-?gap|offline bundle|--image-archive/i);
  });

  it.each(files.filter(claims))('%s never describes AI as coming', (file) => {
    const text = words[file] ?? '';
    for (const pattern of [
      /AI[^.]{0,40}\b(coming|not in Bemmoly yet|not yet|still to come|once it (ships|arrives)|when it comes|on the roadmap|planned|in a later release)/i,
      /(coming soon|planned|roadmap|coming next)[^.]{0,40}\bAI\b/i,
    ]) {
      expect(text, `${file}: ${text.match(pattern)?.[0]}`).not.toMatch(pattern);
    }
  });

  it('names no version on work that has not shipped', () => {
    for (const file of files.filter(claims)) {
      expect(words[file], file).not.toMatch(
        /coming (soon )?in \d|planned for \d|in 0\.\d+ or later/i,
      );
    }
  });

  it.each(files.filter((file) => file.endsWith('.html')))(
    '%s sends every Install button to the install page',
    (file) => {
      const page = parsePage(readFileSync(new URL(file, dist), 'utf8'));
      const installs = page
        .querySelectorAll('a[href]')
        .filter((link) =>
          /^\s*(install|read the install guide|the full install guide)\s*$/i.test(link.textContent),
        );
      for (const link of installs) {
        expect(link.getAttribute('href')?.value, `${file}: ${link.textContent.trim()}`).toBe(
          INSTALL_HREF,
        );
      }
    },
  );

  it('links nowhere to the retired install guide', () => {
    for (const file of files) {
      expect(readFileSync(new URL(file, dist), 'utf8'), file).not.toMatch(/\/docs\/install\b/);
    }
  });

  it('describes AI as it ships: optional, off until an admin turns it on', () => {
    const home = words['index.html'] ?? '';
    expect(home).toMatch(/off until an admin turns it on/);
    expect(home).toContain('models.dev');
    expect(words['llms.txt']).toMatch(/AI shipped in 0\.5 and is optional/);
  });
});
