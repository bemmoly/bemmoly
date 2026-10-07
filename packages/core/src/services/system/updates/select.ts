import type { AvailableUpdate, Release, ReleaseChannel, ReleaseManifest } from '@bemmoly/shared';
import semver from 'semver';

/**
 * The newest release newer than `current` in the channel (beta also sees stable),
 * skipping releases that cannot be reached directly from `current`.
 */
export function selectAvailable(
  manifest: ReleaseManifest,
  channel: ReleaseChannel,
  current: string,
): Release | null {
  const candidates = manifest.releases.filter((release) => {
    if (channel === 'stable' && release.channel !== 'stable') return false;
    if (!semver.valid(release.version) || !semver.valid(current)) return false;
    if (!semver.gt(release.version, current)) return false;
    return !release.minimumFrom || semver.gte(current, release.minimumFrom);
  });
  return candidates.sort((a, b) => semver.rcompare(a.version, b.version))[0] ?? null;
}

export function toAvailableUpdate(release: Release): AvailableUpdate {
  return {
    version: release.version,
    publishedAt: release.publishedAt,
    notes: release.notes,
    ...(release.notesUrl ? { notesUrl: release.notesUrl } : {}),
    slowChangesets: release.changesets.filter((changeset) => changeset.slow),
    irreversibleChangesets: release.changesets.filter((changeset) => changeset.irreversible),
    configChanges: release.configChanges,
  };
}
