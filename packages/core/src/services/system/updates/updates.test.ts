import { releaseManifestSchema, type ReleaseManifest } from '@bemmoly/shared';
import { generateKeyPairSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { canonicalJson, signManifest, verifyManifestSignature } from './manifest-signature.ts';
import { selectAvailable, toAvailableUpdate } from './select.ts';

const DIGEST = `sha256:${'b'.repeat(64)}`;
const release = (
  version: string,
  channel: 'stable' | 'beta',
  extra: Record<string, unknown> = {},
) => ({
  version,
  channel,
  publishedAt: '2026-10-01T00:00:00Z',
  notes: `Notes for ${version}`,
  images: {
    app: { reference: `ghcr.io/bemmoly/bemmoly:${version}`, digest: DIGEST },
    updater: { reference: `ghcr.io/bemmoly/updater:${version}`, digest: DIGEST },
  },
  ...extra,
});

const rawManifest = {
  schemaVersion: 1,
  generatedAt: '2026-10-02T00:00:00Z',
  channels: { stable: '1.3.0', beta: '1.4.0-beta.1' },
  releases: [
    release('1.2.4', 'stable'),
    release('1.3.0', 'stable', {
      changesets: [
        { module: 'work', id: '0012-rank', slow: true },
        { module: 'docs', id: '0004-drop-legacy', irreversible: true },
      ],
    }),
    release('1.4.0-beta.1', 'beta'),
    release('2.0.0', 'stable', { minimumFrom: '1.3.0' }),
  ],
};

describe('release manifest', () => {
  const manifest: ReleaseManifest = releaseManifestSchema.parse(rawManifest);

  it('offers the newest release in the channel that is reachable from here', () => {
    expect(selectAvailable(manifest, 'stable', '1.2.4')?.version).toBe('1.3.0');
    expect(selectAvailable(manifest, 'stable', '1.3.0')?.version).toBe('2.0.0');
    expect(selectAvailable(manifest, 'beta', '1.2.4')?.version).toBe('1.4.0-beta.1');
    expect(selectAvailable(manifest, 'stable', '2.0.0')).toBeNull();
  });

  it('flags slow and irreversible changesets for the Update dialog', () => {
    const chosen = selectAvailable(manifest, 'stable', '1.2.4');
    if (!chosen) throw new Error('expected an update');
    const available = toAvailableUpdate(chosen);
    expect(available.slowChangesets.map((item) => item.id)).toEqual(['0012-rank']);
    expect(available.irreversibleChangesets.map((item) => item.id)).toEqual(['0004-drop-legacy']);
  });

  it('verifies a signature over the canonical JSON and rejects any edit', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const signed = signManifest(
      rawManifest,
      privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      'release-2026',
    );
    expect(verifyManifestSignature(signed, pem)).toBe(true);
    // Key order does not matter, content does.
    expect(verifyManifestSignature(JSON.parse(canonicalJson(signed)), pem)).toBe(true);
    expect(verifyManifestSignature({ ...signed, channels: { stable: '9.9.9' } }, pem)).toBe(false);
    expect(verifyManifestSignature(rawManifest, pem)).toBe(false);
  });

  it('documents the same shape in deploy/release-manifest.schema.json', async () => {
    const file = new URL('../../../../../../deploy/release-manifest.schema.json', import.meta.url);
    const documented = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    const generated = z.toJSONSchema(releaseManifestSchema, { io: 'input' }) as Record<
      string,
      unknown
    >;
    expect(documented['properties']).toEqual(generated['properties']);
    expect(documented['required']).toEqual(generated['required']);
  });
});
