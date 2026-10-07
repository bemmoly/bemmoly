import { z } from 'zod';

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

export const semverSchema = z.string().regex(SEMVER, 'must be a semantic version such as 1.2.0');

export const releaseChannelSchema = z.enum(['stable', 'beta']);

export const releaseImageSchema = z.object({
  /** Repository and tag, e.g. ghcr.io/bemmoly/bemmoly:1.2.0. */
  reference: z.string().min(1),
  digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

export const releaseChangesetSchema = z.object({
  module: z.string().min(1),
  id: z.string().min(1),
  description: z.string().optional(),
  /** Flagged by the migration lint: takes long on large tables. */
  slow: z.boolean().default(false),
  /** Has no `down`; rolling back past it needs a restore. */
  irreversible: z.boolean().default(false),
});

export const releaseSchema = z.object({
  version: semverSchema,
  channel: releaseChannelSchema,
  publishedAt: z.iso.datetime(),
  /** Markdown release notes shown before the admin confirms. */
  notes: z.string(),
  notesUrl: z.url().optional(),
  images: z.object({ app: releaseImageSchema, updater: releaseImageSchema }),
  changesets: z.array(releaseChangesetSchema).default([]),
  configChanges: z.array(z.string()).default([]),
  /** The oldest version that may update to this one directly. */
  minimumFrom: semverSchema.optional(),
});

export const releaseSignatureSchema = z.object({
  algorithm: z.literal('ecdsa-p256-sha256'),
  keyId: z.string().min(1),
  /** Base64 DER signature over the canonical JSON of the manifest without `signature`. */
  value: z.string().min(1),
});

/** Served at the release manifest URL; documented in deploy/release-manifest.schema.json. */
export const releaseManifestSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.iso.datetime(),
  channels: z.object({ stable: semverSchema.optional(), beta: semverSchema.optional() }),
  releases: z.array(releaseSchema).min(1),
  signature: releaseSignatureSchema.optional(),
});

export type ReleaseChannel = z.infer<typeof releaseChannelSchema>;
export type ReleaseImage = z.infer<typeof releaseImageSchema>;
export type ReleaseChangeset = z.infer<typeof releaseChangesetSchema>;
export type Release = z.infer<typeof releaseSchema>;
export type ReleaseSignature = z.infer<typeof releaseSignatureSchema>;
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;
