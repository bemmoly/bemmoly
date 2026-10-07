import { releaseManifestSchema, type ReleaseChannel, type ReleaseManifest } from '@bemmoly/shared';
import semver from 'semver';
import { fetchReleaseManifest } from '../../../clients/release-manifest.ts';
import type { SystemDependencies } from '../deps.ts';
import { publishSystemEvent } from '../events.ts';
import { DEFAULT_MANIFEST_URLS, readSetting } from '../settings.ts';
import { selectAvailable } from './select.ts';
import { readUpdateCheckState, writeUpdateCheckState, type UpdateCheckState } from './state.ts';

export const UPDATE_CHECK_JOB = 'system.update-check';
export const UPDATE_CHECK_CRON = '17 4 * * *';

/** The beta channel also sees stable releases; an admin-set URL replaces both. */
function manifestUrls(channel: ReleaseChannel, override: string | null): string[] {
  if (override) return [override];
  return channel === 'stable'
    ? [DEFAULT_MANIFEST_URLS.stable]
    : [DEFAULT_MANIFEST_URLS.beta, DEFAULT_MANIFEST_URLS.stable];
}

/** The newest release offered across the channel's manifests; fails only if every fetch does. */
async function newestAvailable(
  urls: readonly string[],
  channel: ReleaseChannel,
  current: string,
): Promise<ReleaseManifest | null> {
  const results = await Promise.allSettled(
    urls.map(async (url) => releaseManifestSchema.parse(await fetchReleaseManifest(url))),
  );
  const fetched = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  if (fetched.length === 0) {
    const first = results.find((result) => result.status === 'rejected');
    throw first?.status === 'rejected' ? first.reason : new Error('No release manifest');
  }
  return (
    fetched
      .map((manifest) => selectAvailable(manifest, channel, current))
      .filter((manifest): manifest is ReleaseManifest => manifest !== null)
      .sort((a, b) => semver.rcompare(a.version, b.version))[0] ?? null
  );
}

/**
 * The daily, opt-in system.update-check: fetch the newest release manifest of the
 * workspace's channel and publish update.available once per new version. The images it
 * names are verified by the updater (cosign, keyless) before anything is installed.
 */
export async function checkForUpdates(
  deps: SystemDependencies,
  options: { force?: boolean } = {},
): Promise<UpdateCheckState | null> {
  const enabled = await readSetting(deps.settings, 'system.updates.check');
  if (!enabled && !options.force) return null;
  const [override, channel] = await Promise.all([
    readSetting(deps.settings, 'system.updates.manifest_url'),
    readSetting(deps.settings, 'system.updates.channel'),
  ]);
  const previous = await readUpdateCheckState(deps.config.dataDir);
  const checkedAt = (deps.now?.() ?? new Date()).toISOString();
  let state: UpdateCheckState;
  try {
    const available = await newestAvailable(
      manifestUrls(channel, override),
      channel,
      deps.config.appVersion,
    );
    state = {
      checkedAt,
      manifest: 'unverified',
      error: null,
      available,
      announced: previous?.announced ?? null,
    };
    if (available && state.announced !== available.version) {
      await publishSystemEvent(
        deps,
        'update.available',
        {
          currentVersion: deps.config.appVersion,
          version: available.version,
          channel,
          publishedAt: available.publishedAt,
          notesUrl: available.notesUrl,
          hasIrreversibleChangesets: available.rollback === 'restore',
        },
        available.version,
      );
      state.announced = available.version;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.logger.warn({ err: error }, 'update check failed');
    state = {
      checkedAt,
      manifest: previous?.manifest ?? null,
      error: message,
      available: previous?.available ?? null,
      announced: previous?.announced ?? null,
    };
  }
  await writeUpdateCheckState(deps.config.dataDir, state);
  return state;
}
