import manifest from '../../package.json' with { type: 'json' };

/** The server package's version; every workspace package carries the same release number. */
export const PACKAGE_VERSION: string = manifest.version;

/**
 * The one version this process reports: BEMMOLY_VERSION when the image or the
 * environment names its release, else the package version. Changelog rows,
 * backup manifests and the System page all record this value.
 */
export function appVersionOf(env: { BEMMOLY_VERSION?: string | undefined }): string {
  return env.BEMMOLY_VERSION ?? PACKAGE_VERSION;
}
