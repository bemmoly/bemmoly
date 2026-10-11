import type { ConfigChanges } from './config-changes.ts';
import { rollbackMode, type SchemaChange } from './schema-changes.ts';
import type { Channel, Release } from './version.ts';

/**
 * The signed release manifest the in-app update check reads (tech design §18). The
 * workflow validates it against deploy/release-manifest.schema.json when that exists.
 */
export interface ReleaseManifest {
  version: string;
  channel: Channel;
  publishedAt: string;
  notesUrl: string;
  images: {
    app: { ref: string; digest: string | null };
    updater: { ref: string; digest: string | null };
  };
  /** The bemmoly command's tarball and its SHA-256, which this signed file vouches for. */
  cli?: ReleaseCli;
  rollback: 'code' | 'restore';
  schemaChangesets: SchemaChange[];
  configChanges: ConfigChanges;
}

export interface ReleaseCli {
  asset: string;
  sha256: string;
}

export interface ManifestInput {
  release: Release;
  publishedAt: Date;
  notesUrl: string;
  appImage: string;
  updaterImage: string;
  appDigest?: string | undefined;
  updaterDigest?: string | undefined;
  cli?: ReleaseCli | undefined;
  schema: readonly SchemaChange[];
  config: ConfigChanges;
}

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function digestOrNull(digest: string | undefined): string | null {
  if (!digest) return null;
  if (!DIGEST.test(digest)) throw new Error(`"${digest}" is not an image digest`);
  return digest;
}

function checkedCli(cli: ReleaseCli, version: string): ReleaseCli {
  if (cli.asset !== `bemmoly-cli-${version}.tar.gz`)
    throw new Error(`"${cli.asset}" is not the bemmoly command of ${version}`);
  if (!SHA256.test(cli.sha256)) throw new Error(`"${cli.sha256}" is not a SHA-256`);
  return { asset: cli.asset, sha256: cli.sha256 };
}

export function buildManifest(input: ManifestInput): ReleaseManifest {
  return {
    version: input.release.version,
    channel: input.release.channel,
    publishedAt: input.publishedAt.toISOString(),
    notesUrl: input.notesUrl,
    images: {
      app: {
        ref: `${input.appImage}:${input.release.version}`,
        digest: digestOrNull(input.appDigest),
      },
      updater: {
        ref: `${input.updaterImage}:${input.release.version}`,
        digest: digestOrNull(input.updaterDigest),
      },
    },
    ...(input.cli ? { cli: checkedCli(input.cli, input.release.version) } : {}),
    rollback: rollbackMode(input.schema),
    schemaChangesets: [...input.schema],
    configChanges: input.config,
  };
}
