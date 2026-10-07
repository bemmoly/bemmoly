import { releaseManifestJsonSchema, releaseManifestSchema } from '@bemmoly/shared';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { selectAvailable, toAvailableUpdate } from './select.ts';

const DIGEST = `sha256:${'b'.repeat(64)}`;

/** Exactly what tools/release `buildManifest` writes for a release. */
function releaseManifest(version: string, channel: 'stable' | 'beta', irreversible = false) {
  return {
    version,
    channel,
    publishedAt: '2026-10-01T00:00:00.000Z',
    notesUrl: `https://github.com/bemmoly/bemmoly/releases/tag/v${version}`,
    images: {
      app: { ref: `ghcr.io/bemmoly/bemmoly:${version}`, digest: DIGEST },
      updater: { ref: `ghcr.io/bemmoly/updater:${version}`, digest: null },
    },
    rollback: irreversible ? 'restore' : 'code',
    schemaChangesets: [
      {
        module: 'work',
        id: '0012-rank',
        description: 'Rank issues',
        slow: true,
        irreversible: false,
      },
      {
        module: 'docs',
        id: '0004-drop-legacy',
        description: 'Drop the legacy body column',
        slow: false,
        irreversible,
      },
    ],
    configChanges: { added: ['BEMMOLY_METRICS_TOKEN'], removed: [] },
  };
}

describe('release manifest', () => {
  it('accepts the manifest the release tooling writes', () => {
    expect(releaseManifestSchema.parse(releaseManifest('1.3.0', 'stable'))).toBeTruthy();
    expect(
      releaseManifestSchema.safeParse({ ...releaseManifest('1.3.0', 'stable'), version: 'v1' })
        .success,
    ).toBe(false);
  });

  it('offers a newer release of the channel, and never a beta on stable', () => {
    const stable = releaseManifestSchema.parse(releaseManifest('1.3.0', 'stable'));
    const beta = releaseManifestSchema.parse(releaseManifest('1.4.0-beta.1', 'beta'));
    expect(selectAvailable(stable, 'stable', '1.2.4')?.version).toBe('1.3.0');
    expect(selectAvailable(stable, 'stable', '1.3.0')).toBeNull();
    expect(selectAvailable(beta, 'stable', '1.2.4')).toBeNull();
    expect(selectAvailable(beta, 'beta', '1.3.0')?.version).toBe('1.4.0-beta.1');
    expect(selectAvailable(stable, 'beta', '1.2.4')?.version).toBe('1.3.0');
  });

  it('flags slow and irreversible changesets for the Update dialog', () => {
    const release = releaseManifestSchema.parse(releaseManifest('1.3.0', 'stable', true));
    const available = toAvailableUpdate(release);
    expect(available.rollback).toBe('restore');
    expect(available.slowChangesets.map((item) => item.id)).toEqual(['0012-rank']);
    expect(available.irreversibleChangesets.map((item) => item.id)).toEqual(['0004-drop-legacy']);
    expect(available.configChanges.added).toEqual(['BEMMOLY_METRICS_TOKEN']);
  });

  it('documents the same shape in deploy/release-manifest.schema.json', async () => {
    const file = new URL('../../../../../../deploy/release-manifest.schema.json', import.meta.url);
    const documented = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    const generated = releaseManifestJsonSchema();
    expect(documented['properties']).toEqual(generated['properties']);
    expect(documented['required']).toEqual(generated['required']);
  });
});
