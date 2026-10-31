import { z } from 'zod';
import { applicationRefSchema } from './catalog.ts';
import {
  idSchema,
  isoDateTimeSchema,
  keysetPageSchema,
  keysetQuerySchema,
  personRefSchema,
  scopePathSchema,
  slugSchema,
} from './common.ts';
import { environmentRefSchema } from './environments.ts';

/*
 * Releases (architecture §11, §7.1): GET /api/v1/pipelines/releases, /releases/:id,
 * POST /releases (Bring your CI registers a release built elsewhere), and
 * GET /releases/compare (what is different between two releases or two environments).
 * A release is one built image plus its configuration, created once and never changed.
 */

export const releaseSourceSchema = z.enum(['runners', 'external', 'adopted']);
export const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/, 'Digests look like sha256:…');

export const releaseTestSummarySchema = z.object({
  total: z.number().int().min(0),
  passed: z.number().int().min(0),
  failed: z.number().int().min(0),
  skipped: z.number().int().min(0),
});

export const provenanceSchema = z.object({
  kind: z.enum(['slsa', 'github-attestation']),
  verified: z.boolean(),
  builder: z.string().nullable(),
  verifiedAt: isoDateTimeSchema.nullable(),
});

export const releaseSchema = z.object({
  id: idSchema,
  application: applicationRefSchema,
  version: z.string(),
  source: releaseSourceSchema,
  run: z.object({ id: idSchema, number: z.number().int() }).nullable(),
  commitSha: z.string(),
  ref: z.string().nullable(),
  imageRepository: z.string().nullable(),
  /** Platform → digest, e.g. "linux/amd64" → "sha256:…". */
  imageDigests: z.record(z.string(), digestSchema),
  resolvedConfig: z.record(z.string(), z.unknown()),
  testSummary: releaseTestSummarySchema.nullable(),
  provenance: provenanceSchema.nullable(),
  hasSbom: z.boolean(),
  notes: z.string().nullable(),
  createdBy: personRefSchema.nullable(),
  createdAt: isoDateTimeSchema,
  /** Where this release runs now, for the release's own page. */
  environments: z.array(environmentRefSchema),
});

export const listReleasesQuerySchema = keysetQuerySchema.extend({
  scope: scopePathSchema.optional(),
  application: slugSchema.optional(),
  source: releaseSourceSchema.optional(),
  q: z.string().trim().max(120).optional(),
});

export const releasesPageSchema = keysetPageSchema(releaseSchema);
export const releaseParamsSchema = z.object({ id: idSchema });

/**
 * POST /releases from Bring your CI: one step at the end of the company's own workflow.
 * GitHub Actions signs with its OIDC token; other CI sends a scoped token.
 */
export const registerReleaseBodySchema = z
  .object({
    application: slugSchema,
    version: z.string().min(1).max(64),
    commitSha: z.string().regex(/^[0-9a-f]{7,64}$/),
    ref: z.string().max(200).optional(),
    imageRepository: z.string().max(300).optional(),
    /** One image for one platform… */
    image: digestSchema.optional(),
    /** …or one per platform. */
    images: z.record(z.string(), digestSchema).optional(),
    tests: releaseTestSummarySchema
      .extend({
        failures: z
          .array(z.object({ file: z.string(), name: z.string(), message: z.string().nullable() }))
          .max(500)
          .default([]),
      })
      .optional(),
    /** A DSSE envelope or SLSA provenance document, verified before it is stored. */
    attestation: z.string().max(1_000_000).optional(),
    externalUrl: z.url().optional(),
    notes: z.string().max(4000).optional(),
  })
  .refine((body) => Boolean(body.image) !== Boolean(body.images), {
    message: 'Send image or images, not both',
  });

/** Compare two releases, or what runs in two environments of one application. */
export const compareQuerySchema = z.union([
  z.object({ from: idSchema, to: idSchema }),
  z.object({ application: slugSchema, fromEnv: slugSchema, toEnv: slugSchema }),
]);

export const compareCommitSchema = z.object({
  sha: z.string(),
  message: z.string(),
  issueKey: z.string().nullable(),
  author: personRefSchema.nullable(),
  authorLogin: z.string().nullable(),
});

export const migrationSchema = z.object({
  description: z.string(),
  reversible: z.boolean(),
  reviewed: z.boolean(),
});

export const configChangeSchema = z.object({
  name: z.string(),
  /** Null for secrets: only that it changed is shown. */
  from: z.string().nullable(),
  to: z.string().nullable(),
  secret: z.boolean(),
});

/** "Prod in us and eu is 4 commits behind": v1.42.3 to v1.43.0 · 2 issues · 1 migration. */
export const releaseCompareSchema = z.object({
  from: z.object({ id: idSchema, version: z.string() }).nullable(),
  to: z.object({ id: idSchema, version: z.string() }),
  commits: z.array(compareCommitSchema),
  issueKeys: z.array(z.string()),
  migrations: z.array(migrationSchema),
  config: z.array(configChangeSchema),
  counts: z.object({
    commits: z.number().int(),
    issues: z.number().int(),
    migrations: z.number().int(),
    config: z.number().int(),
    authors: z.number().int(),
  }),
  /** The forge's compare page. */
  compareUrl: z.string().nullable(),
});

export type ReleaseSource = z.infer<typeof releaseSourceSchema>;
export type ReleaseTestSummary = z.infer<typeof releaseTestSummarySchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type Release = z.infer<typeof releaseSchema>;
export type ListReleasesQuery = z.infer<typeof listReleasesQuerySchema>;
export type ReleasesPage = z.infer<typeof releasesPageSchema>;
export type RegisterReleaseBody = z.input<typeof registerReleaseBodySchema>;
export type CompareQuery = z.infer<typeof compareQuerySchema>;
export type CompareCommit = z.infer<typeof compareCommitSchema>;
export type Migration = z.infer<typeof migrationSchema>;
export type ConfigChange = z.infer<typeof configChangeSchema>;
export type ReleaseCompare = z.infer<typeof releaseCompareSchema>;
