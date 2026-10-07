import { requestJson } from './http-json.ts';

const MANIFEST_MAX_BYTES = 2 * 1024 * 1024;
const RELEASES_API = 'https://api.github.com/repos/bemmoly/bemmoly/releases?per_page=20';
export const MANIFEST_ASSET = 'release-manifest.json';

/** Fetches a release manifest as untrusted JSON; the update service validates it. */
export async function fetchReleaseManifest(url: string, timeoutMs = 15_000): Promise<unknown> {
  return requestJson({ url, timeoutMs, maxBytes: MANIFEST_MAX_BYTES });
}

interface GithubRelease {
  draft?: boolean;
  prerelease?: boolean;
  assets?: { name?: string; browser_download_url?: string }[];
}

/**
 * The manifest of the newest pre-release on GitHub Releases, for the beta channel
 * (GitHub's "latest" download link only follows full releases). Null when there is none.
 */
export async function latestPrereleaseManifestUrl(timeoutMs = 15_000): Promise<string | null> {
  const releases = (await requestJson({
    url: RELEASES_API,
    timeoutMs,
    maxBytes: 8 * 1024 * 1024,
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'bemmoly-update-check' },
  })) as GithubRelease[];
  for (const release of Array.isArray(releases) ? releases : []) {
    if (release.draft || !release.prerelease) continue;
    const asset = release.assets?.find((item) => item.name === MANIFEST_ASSET);
    if (asset?.browser_download_url) return asset.browser_download_url;
  }
  return null;
}
