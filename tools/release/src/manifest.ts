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
  rollback: 'code' | 'restore';
  schemaChangesets: SchemaChange[];
  configChanges: ConfigChanges;
}

export interface ManifestInput {
  release: Release;
  publishedAt: Date;
  notesUrl: string;
  appImage: string;
  updaterImage: string;
  appDigest?: string | undefined;
  updaterDigest?: string | undefined;
  schema: readonly SchemaChange[];
  config: ConfigChanges;
}

const DIGEST = /^sha256:[0-9a-f]{64}$/;

function digestOrNull(digest: string | undefined): string | null {
  if (!digest) return null;
  if (!DIGEST.test(digest)) throw new Error(`"${digest}" is not an image digest`);
  return digest;
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
    rollback: rollbackMode(input.schema),
    schemaChangesets: [...input.schema],
    configChanges: input.config,
  };
}
