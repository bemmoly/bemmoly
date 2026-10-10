/**
 * The proof behind the homepage's claims (src/data/proofs.ts). A proof that names a file must
 * point at that file in the repository, and the file must still contain the line it quotes:
 * the day a change removes the line, this fails and the site stops making the claim. The
 * built page must show every proof. Run `pnpm build` first for the last check.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OWN, PROMISES, type Proof } from '../src/data/proofs.ts';
import { REPO_URL, sourceUrl } from '../src/lib/links.ts';
import { hrefsOf, parsePage } from './dom.ts';

const repo = new URL('../../../', import.meta.url);
const proofs: Proof[] = [
  ...PROMISES.flatMap((promise) => promise.proofs),
  ...OWN.map((fact) => fact.proof),
];
const fileProofs = proofs.filter((proof) => proof.file);

describe('proofs', () => {
  it('backs each of the three promises, in order, with at least one file', () => {
    expect(PROMISES.map((promise) => promise.title)).toEqual([
      '100% open source',
      'No pricing',
      'No in-app purchases',
    ]);
    for (const promise of PROMISES) {
      expect(
        promise.proofs.some((proof) => proof.file),
        promise.title,
      ).toBe(true);
    }
  });

  it('gives every self-hosting fact a file of its own', () => {
    for (const fact of OWN) expect(fact.proof.file, fact.title).toBeTruthy();
  });

  it.each(fileProofs)(
    '$file still says what the site quotes',
    ({ file = '', quote = '', href }) => {
      const path = new URL(file, repo);
      expect(existsSync(path), file).toBe(true);
      expect(readFileSync(path, 'utf8')).toContain(quote);
      expect(href).toBe(sourceUrl(file));
    },
  );

  it('points every other proof at the repository or a page of the site', () => {
    for (const proof of proofs.filter((entry) => !entry.file)) {
      expect(proof.href.startsWith(REPO_URL) || proof.href.startsWith('/'), proof.label).toBe(true);
    }
  });

  it('shows every proof on the homepage', () => {
    const hrefs = hrefsOf(
      parsePage(readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')),
    );
    for (const proof of proofs) expect(hrefs, proof.label).toContain(proof.href);
  });
});
