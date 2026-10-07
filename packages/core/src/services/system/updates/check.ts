import { releaseManifestSchema } from '@bemmoly/shared';
import { readFile } from 'node:fs/promises';
import { fetchReleaseManifest } from '../../../clients/release-manifest.ts';
import type { SystemDependencies } from '../deps.ts';
import { publishSystemEvent } from '../events.ts';
import { readSetting } from '../settings.ts';
import { verifyManifestSignature } from './manifest-signature.ts';
import { selectAvailable } from './select.ts';
import { readUpdateCheckState, writeUpdateCheckState, type UpdateCheckState } from './state.ts';

export const UPDATE_CHECK_JOB = 'system.update-check';
export const UPDATE_CHECK_CRON = '17 4 * * *';

export class ManifestSignatureError extends Error {
  override readonly name = 'ManifestSignatureError';
}

async function verification(
  deps: SystemDependencies,
  raw: unknown,
): Promise<'verified' | 'unverified'> {
  if (!deps.config.releaseKeyFile) return 'unverified';
  const key = await readFile(deps.config.releaseKeyFile, 'utf8');
  if (!verifyManifestSignature(raw, key)) {
    throw new ManifestSignatureError(
      'The release manifest signature does not verify; no update is offered',
    );
  }
  return 'verified';
}

/**
 * The daily, opt-in system.update-check: fetch the release manifest, verify its
 * signature when the image carries the release key, and publish update.available
 * once per new version in the workspace's channel.
 */
export async function checkForUpdates(
  deps: SystemDependencies,
  options: { force?: boolean } = {},
): Promise<UpdateCheckState | null> {
  const enabled = await readSetting(deps.settings, 'system.updates.check');
  if (!enabled && !options.force) return null;
  const [url, channel] = await Promise.all([
    readSetting(deps.settings, 'system.updates.manifest_url'),
    readSetting(deps.settings, 'system.updates.channel'),
  ]);
  const previous = await readUpdateCheckState(deps.config.dataDir);
  const checkedAt = (deps.now?.() ?? new Date()).toISOString();
  let state: UpdateCheckState;
  try {
    const raw = await fetchReleaseManifest(url);
    const manifestState = await verification(deps, raw);
    const manifest = releaseManifestSchema.parse(raw);
    const available = selectAvailable(manifest, channel, deps.config.appVersion);
    state = {
      checkedAt,
      manifest: manifestState,
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
          notesUrl: available.notesUrl ?? null,
          hasIrreversibleChangesets: available.changesets.some(
            (changeset) => changeset.irreversible,
          ),
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
