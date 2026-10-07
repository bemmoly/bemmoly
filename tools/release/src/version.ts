/** Versions are plain numbers; `-beta.N` is the only suffix (AGENTS.md §6). */
const RELEASE_VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/;

export type Channel = 'stable' | 'beta';

export interface Release {
  version: string;
  tag: string;
  channel: Channel;
  prerelease: boolean;
  /** `X.Y`, for the floating minor image tag on stable releases. */
  minor: string;
}

export function parseRelease(input: string): Release {
  const version = input.startsWith('v') ? input.slice(1) : input;
  const match = RELEASE_VERSION.exec(version);
  if (!match) {
    throw new Error(
      `"${input}" is not a release version: use X.Y.Z, or X.Y.Z-beta.N on the beta channel`,
    );
  }
  const beta = match[4] !== undefined;
  return {
    version,
    tag: `v${version}`,
    channel: beta ? 'beta' : 'stable',
    prerelease: beta,
    minor: `${match[1]}.${match[2]}`,
  };
}

function parts(release: Release): number[] {
  const [core = '', beta] = release.version.split('-beta.');
  // A stable release sorts after every beta of the same version.
  return [...core.split('.').map(Number), beta === undefined ? Infinity : Number(beta)];
}

export function compareReleases(a: Release, b: Release): number {
  const left = parts(a);
  const right = parts(b);
  for (let index = 0; index < left.length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * The release the notes start from. A stable release looks back to the previous stable
 * one, so its notes cover every beta in between; a beta looks back to whatever came last.
 */
export function previousRelease(current: Release, tags: readonly string[]): Release | undefined {
  return tags
    .flatMap((tag) => {
      try {
        return [parseRelease(tag)];
      } catch {
        return [];
      }
    })
    .filter((candidate) => compareReleases(candidate, current) < 0)
    .filter((candidate) => current.prerelease || !candidate.prerelease)
    .sort(compareReleases)
    .at(-1);
}

/** Image tags for a release: the exact version, plus floating tags for its channel. */
export function imageTags(image: string, release: Release): string[] {
  const floating = release.prerelease ? ['beta'] : [release.minor, 'latest'];
  return [release.version, ...floating].map((tag) => `${image}:${tag}`);
}
