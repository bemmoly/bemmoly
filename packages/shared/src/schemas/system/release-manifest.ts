import { z } from 'zod';

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

export const semverSchema = z.string().regex(SEMVER, 'must be a semantic version such as 1.2.0');

export const releaseChannelSchema = z.enum(['stable', 'beta']);

export const releaseImageSchema = z.object({
  /** Repository and tag, e.g. ghcr.io/bemmoly/bemmoly:1.2.0. */
  ref: z.string().min(1),
  /** Null when the image was not built for this release. */
  digest: z
    .string()
    .regex(/^sha256:[0-9a-f]{64}$/)
    .nullable(),
});

export const releaseChangesetSchema = z.object({
  module: z.string().min(1),
  id: z.string().min(1),
  description: z.string(),
  /** Takes long on large tables (marked slow, a backfill, or outside a transaction). */
  slow: z.boolean(),
  /** Marked irreversible or has no `down`: rolling back past it needs a restore. */
  irreversible: z.boolean(),
});

/**
 * One release, as tools/release writes it to the GitHub release (release-manifest.json,
 * signed keyless with a detached release-manifest.json.sigstore.json bundle). The
 * daily update check fetches the newest one per channel. Documented as JSON Schema in
 * deploy/release-manifest.schema.json, which the release workflow validates against.
 */
export const releaseManifestSchema = z.object({
  version: semverSchema,
  channel: releaseChannelSchema,
  publishedAt: z.iso.datetime(),
  notesUrl: z.url(),
  images: z.object({ app: releaseImageSchema, updater: releaseImageSchema }),
  /** The rollback mode this release implies on its own: restore once anything is irreversible. */
  rollback: z.enum(['code', 'restore']),
  schemaChangesets: z.array(releaseChangesetSchema),
  configChanges: z.object({ added: z.array(z.string()), removed: z.array(z.string()) }),
});

export type ReleaseChannel = z.infer<typeof releaseChannelSchema>;
export type ReleaseImage = z.infer<typeof releaseImageSchema>;
export type ReleaseChangeset = z.infer<typeof releaseChangesetSchema>;
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;

function withoutFormats(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutFormats);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'format')
        .map(([key, item]) => [key, withoutFormats(item)]),
    );
  }
  return value;
}

/**
 * The JSON Schema published as deploy/release-manifest.schema.json. `format` keywords
 * are dropped (the patterns carry the same rules) so strict validators without format
 * plugins, such as the release workflow's ajv-cli, accept it.
 */
export function releaseManifestJsonSchema(): Record<string, unknown> {
  return withoutFormats(z.toJSONSchema(releaseManifestSchema, { io: 'input' })) as Record<
    string,
    unknown
  >;
}
