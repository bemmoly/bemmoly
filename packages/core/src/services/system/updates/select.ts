import type { AvailableUpdate, ReleaseChannel, ReleaseManifest } from '@bemmoly/shared';
import semver from 'semver';

/**
 * The release in the manifest when it is newer than `current` and belongs to the
 * channel: the stable channel never offers a beta; the beta channel also takes stable.
 */
export function selectAvailable(
  manifest: ReleaseManifest,
  channel: ReleaseChannel,
  current: string,
): ReleaseManifest | null {
  if (channel === 'stable' && manifest.channel !== 'stable') return null;
  if (!semver.valid(manifest.version) || !semver.valid(current)) return null;
  return semver.gt(manifest.version, current) ? manifest : null;
}

export function toAvailableUpdate(release: ReleaseManifest): AvailableUpdate {
  return {
    version: release.version,
    publishedAt: release.publishedAt,
    notesUrl: release.notesUrl,
    rollback: release.rollback,
    slowChangesets: release.schemaChangesets.filter((changeset) => changeset.slow),
    irreversibleChangesets: release.schemaChangesets.filter((changeset) => changeset.irreversible),
    configChanges: release.configChanges,
  };
}
