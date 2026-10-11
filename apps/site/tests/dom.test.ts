import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hrefsOf, idsOf, parsePage, scriptsOf } from './dom.ts';

describe('page parsing for the site checks', () => {
  it('finds scripts whatever the tag case or end-tag spacing', () => {
    const page = parsePage(
      '<!doctype html><html><head><SCRIPT SRC="/x.js"></SCRIPT ></head>' +
        '<body><Script>let a = 1;</script\t></body></html>',
    );
    expect(scriptsOf(page)).toEqual([
      { src: '/x.js', body: '' },
      { src: undefined, body: 'let a = 1;' },
    ]);
  });

  it('reads links and ids from attributes, in any order', () => {
    const page = parsePage(
      '<p><A class="c" HREF="/docs" id="top">Docs</A><span id="x"></span></p>',
    );
    expect(hrefsOf(page)).toEqual(['/docs']);
    expect([...idsOf(page)]).toEqual(['top', 'x']);
  });

  it('returns inline script text byte for byte, as the CSP hashes it', () => {
    const index = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
    const inline = scriptsOf(parsePage(index)).filter((script) => script.src === undefined);
    expect(inline.length).toBeGreaterThan(0);
    for (const { body } of inline) {
      expect(index).toContain(`>${body}</script>`);
    }
  });
});
