/**
 * The strict content security policy allows inline scripts only by hash. The container test
 * proves the served headers; this one runs without Docker and fails as soon as a built inline
 * script and the Caddyfile's hashes drift apart, in either direction. Run `pnpm build` first.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isSitePage, parsePage, scriptsOf } from './dom.ts';

const dist = new URL('../dist/', import.meta.url);
const caddy = readFileSync(new URL('../Caddyfile', import.meta.url), 'utf8');
const policy = /\?Content-Security-Policy "([^"]+)"/.exec(caddy)?.[1] ?? '';
const allowed = new Set([...policy.matchAll(/'(sha256-[^']+)'/g)].map((match) => match[1]));
const pages = readdirSync(dist, { recursive: true, encoding: 'utf8' }).filter(isSitePage);

/** Every inline script that runs: JSON-LD is data, which the policy never needs to allow. */
const inlineHashes = (file: string) =>
  scriptsOf(parsePage(readFileSync(new URL(file, dist), 'utf8')))
    .filter((script) => script.src === undefined && script.type !== 'application/ld+json')
    .map(({ body }) => `sha256-${createHash('sha256').update(body).digest('base64')}`);

describe('content security policy', () => {
  it('keeps scripts to the site itself and hashed inline code', () => {
    expect(policy).toContain("default-src 'self'");
    expect(policy).toMatch(/script-src 'self'( 'sha256-[^']+')+;/);
    expect(policy).not.toMatch(/script-src[^;]*unsafe/);
  });

  it.each(pages)('%s runs no inline script the policy does not name', (file) => {
    for (const hash of inlineHashes(file)) expect(allowed, file).toContain(hash);
  });

  it('names no hash that no page uses', () => {
    const used = new Set(pages.flatMap(inlineHashes));
    for (const hash of allowed) expect(used, hash).toContain(hash);
  });
});
