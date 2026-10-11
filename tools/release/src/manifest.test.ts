import { describe, expect, it } from 'vitest';
import { buildManifest, type ManifestInput } from './manifest.ts';
import { parseRelease } from './version.ts';

const SHA = 'a'.repeat(64);

function input(overrides: Partial<ManifestInput> = {}): ManifestInput {
  return {
    release: parseRelease('0.12.0'),
    publishedAt: new Date('2026-10-11T00:00:00Z'),
    notesUrl: 'https://example.test/releases/tag/v0.12.0',
    appImage: 'ghcr.io/bemmoly/bemmoly',
    updaterImage: 'ghcr.io/bemmoly/updater',
    schema: [],
    config: { added: [], removed: [] },
    ...overrides,
  };
}

describe('release manifest', () => {
  it('lists the bemmoly command and its checksum, which the signature then covers', () => {
    const manifest = buildManifest(
      input({ cli: { asset: 'bemmoly-cli-0.12.0.tar.gz', sha256: SHA } }),
    );
    expect(manifest.cli).toEqual({ asset: 'bemmoly-cli-0.12.0.tar.gz', sha256: SHA });
    expect(Object.keys(manifest)[0]).toBe('version');
  });

  it('leaves the command out when the release did not build one', () => {
    expect(buildManifest(input())).not.toHaveProperty('cli');
  });

  it("refuses another release's command or a bad checksum", () => {
    expect(() =>
      buildManifest(input({ cli: { asset: 'bemmoly-cli-0.11.0.tar.gz', sha256: SHA } })),
    ).toThrow(/not the bemmoly command of 0.12.0/);
    expect(() =>
      buildManifest(input({ cli: { asset: 'bemmoly-cli-0.12.0.tar.gz', sha256: 'abc' } })),
    ).toThrow(/not a SHA-256/);
  });
});
