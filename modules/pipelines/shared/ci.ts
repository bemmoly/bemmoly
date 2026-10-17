import { z } from 'zod';
import { applicationRefSchema } from './catalog.ts';
import { idSchema, isoDateTimeSchema, slugSchema } from './common.ts';

/*
 * Bring your CI (architecture §7.1): GET/POST/DELETE /api/v1/pipelines/ci/issuers,
 * /ci/trust-rules and /ci/tokens, and GET /ci/checks (other CI systems' results per commit,
 * usable as gates). Releases are registered with POST /releases (releases.ts).
 */

export const ciIssuerKindSchema = z.enum(['github', 'gitlab', 'circleci', 'buildkite', 'oidc']);

/**
 * Where each fact sits in the issuer's token: a claim name, or a template of claims such as
 * "{organization_slug}/{pipeline_slug}". Missing entries take the kind's defaults.
 */
export const claimMappingSchema = z.object({
  repository: z.string().min(1).max(200).optional(),
  ref: z.string().min(1).max(200).optional(),
  workflow: z.string().min(1).max(200).optional(),
  environment: z.string().min(1).max(200).optional(),
  sha: z.string().min(1).max(200).optional(),
  actor: z.string().min(1).max(200).optional(),
});

const httpsUrl = z.url({ protocol: /^https$/ });

export const ciIssuerSchema = z.object({
  id: idSchema,
  key: slugSchema,
  name: z.string(),
  kind: ciIssuerKindSchema,
  issuer: z.string(),
  discoveryUrl: z.string(),
  /** Null: the token must be for this server's own URL. */
  audience: z.string().nullable(),
  claimMapping: claimMappingSchema,
  enabled: z.boolean(),
  ruleCount: z.number().int(),
});

export const createCiIssuerBodySchema = z.object({
  key: slugSchema,
  name: z.string().trim().min(1).max(80),
  kind: ciIssuerKindSchema,
  issuer: httpsUrl,
  /** Defaults to the issuer's /.well-known/openid-configuration. */
  discoveryUrl: httpsUrl.optional(),
  audience: z.string().trim().min(1).max(300).optional(),
  claimMapping: claimMappingSchema.default({}),
});

/** "refs/heads/main", "refs/tags/v*", "main": a glob where * matches within a segment, ** across. */
const patternSchema = z.string().trim().min(1).max(200);

export const trustRuleSchema = z.object({
  id: idSchema,
  issuer: z.object({ id: idSchema, key: slugSchema, name: z.string() }),
  repository: z.string(),
  refs: z.array(z.string()),
  workflows: z.array(z.string()),
  environments: z.array(z.string()),
  /** Empty: every application whose repository this is. */
  applications: z.array(applicationRefSchema),
  enabled: z.boolean(),
  createdAt: isoDateTimeSchema,
});

export const createTrustRuleBodySchema = z.object({
  issuer: slugSchema,
  /** owner/repository as the issuer names it (GitLab: group/project). */
  repository: z.string().trim().min(1).max(300),
  refs: z.array(patternSchema).max(20).default([]),
  workflows: z.array(patternSchema).max(20).default([]),
  environments: z.array(patternSchema).max(20).default([]),
  applications: z.array(slugSchema).max(100).default([]),
});

export const ciTokenSchema = z.object({
  id: idSchema,
  name: z.string(),
  /** The first characters, to tell tokens apart: "bpci_3f9a". */
  prefix: z.string(),
  applications: z.array(applicationRefSchema),
  expiresAt: isoDateTimeSchema.nullable(),
  lastUsedAt: isoDateTimeSchema.nullable(),
  revokedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const createCiTokenBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  applications: z.array(slugSchema).min(1).max(100),
  expiresAt: isoDateTimeSchema.optional(),
});

/** The token itself is shown once, here, and never again. */
export const createdCiTokenSchema = ciTokenSchema.extend({ token: z.string() });

export const externalCheckSchema = z.object({
  kind: z.enum(['check_run', 'workflow_run', 'reported']),
  name: z.string(),
  path: z.string().nullable(),
  status: z.enum(['queued', 'in_progress', 'completed']),
  conclusion: z.string().nullable(),
  /** pass when completed with success, neutral or skipped; fail when completed otherwise. */
  verdict: z.enum(['pass', 'fail', 'pending']),
  url: z.string().nullable(),
  occurredAt: isoDateTimeSchema,
});

export const listExternalChecksQuerySchema = z.object({
  application: slugSchema,
  commit: z.string().regex(/^[0-9a-f]{7,64}$/),
});

export const ciIssuersResponseSchema = z.object({ items: z.array(ciIssuerSchema) });
export const trustRulesResponseSchema = z.object({ items: z.array(trustRuleSchema) });
export const ciTokensResponseSchema = z.object({ items: z.array(ciTokenSchema) });
export const externalChecksResponseSchema = z.object({ items: z.array(externalCheckSchema) });
export const ciIdParamsSchema = z.object({ id: idSchema });
export const listTrustRulesQuerySchema = z.object({ application: slugSchema.optional() });

export type CiIssuerKind = z.infer<typeof ciIssuerKindSchema>;
export type ClaimMapping = z.infer<typeof claimMappingSchema>;
export type CiIssuer = z.infer<typeof ciIssuerSchema>;
export type CreateCiIssuerBody = z.infer<typeof createCiIssuerBodySchema>;
export type TrustRule = z.infer<typeof trustRuleSchema>;
export type CreateTrustRuleBody = z.infer<typeof createTrustRuleBodySchema>;
export type CiToken = z.infer<typeof ciTokenSchema>;
export type CreateCiTokenBody = z.infer<typeof createCiTokenBodySchema>;
export type CreatedCiToken = z.infer<typeof createdCiTokenSchema>;
export type ExternalCheck = z.infer<typeof externalCheckSchema>;
export type ListExternalChecksQuery = z.infer<typeof listExternalChecksQuerySchema>;
