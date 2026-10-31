import { z } from 'zod';
import { domainColorSchema, groupSchema, applicationSchema, domainSchema } from './catalog.ts';
import {
  ciModeSchema,
  idSchema,
  isoDateTimeSchema,
  keysetPageSchema,
  keysetQuerySchema,
  lifecycleSchema,
  personRefSchema,
  promotionModeSchema,
  runtimeSchema,
  slugSchema,
  teamRefSchema,
  tierSchema,
} from './common.ts';

/*
 * Catalog writes and discovery (architecture §9): POST/PATCH/DELETE /domains, /groups,
 * /applications, PUT /applications/:key/dependencies, GET /catalog-changes, and
 * GET /discovery/proposals with POST /discovery/acceptances, /discovery/dismissals and
 * /discovery/scans. An application whose `.bemmoly/application.yaml` lives in a repository
 * takes its truth from that file: an edit in the UI opens a pull request instead of
 * changing the row, or waits as a pending change when the code host cannot take one.
 */

const description = z.string().trim().max(2000).nullable();
const labels = z.array(z.string().trim().min(1).max(60)).max(50);
/** "commerce/checkout": a group is addressed through its domain. */
export const groupPathSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9][a-z0-9-]{0,62}\/[a-z0-9][a-z0-9-]{0,62}$/,
    'Groups look like "commerce/checkout"',
  );

export const createDomainBodySchema = z.object({
  key: slugSchema,
  name: z.string().trim().min(1).max(80),
  description: description.optional(),
  color: domainColorSchema.optional(),
});
export const updateDomainBodySchema = createDomainBodySchema.omit({ key: true }).partial();

export const createGroupBodySchema = z.object({
  domain: slugSchema,
  key: slugSchema,
  name: z.string().trim().min(1).max(80),
  description: description.optional(),
});
export const updateGroupBodySchema = createGroupBodySchema.omit({ key: true }).partial();
export const groupParamsSchema = z.object({ id: idSchema });

export const repositoryInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)+$/, 'owner/repository'),
  provider: z.enum(['github', 'gitlab', 'bitbucket', 'other']).default('github'),
  defaultBranch: z.string().trim().min(1).max(200).default('main'),
  url: z.url().nullable().optional(),
});

const applicationFields = {
  name: z.string().trim().min(1).max(120),
  description: description.optional(),
  group: groupPathSchema,
  /** A kernel team's id, "team/<slug>" as application.yaml writes it, or null for no owner. */
  owner: z.union([idSchema, z.string().regex(/^team\/[a-z0-9][a-z0-9-]{0,62}$/)]).nullable(),
  tier: tierSchema,
  labels,
  lifecycle: lifecycleSchema,
  runtime: runtimeSchema,
  ciMode: ciModeSchema,
  promotionMode: promotionModeSchema,
  dependsOn: z.array(slugSchema).max(100),
  paths: z.array(z.string().min(1).max(300)).max(100),
};

export const createApplicationBodySchema = z.object({
  key: slugSchema,
  ...applicationFields,
  owner: applicationFields.owner.default(null),
  tier: tierSchema.default(2),
  labels: labels.default([]),
  lifecycle: lifecycleSchema.default('production'),
  runtime: runtimeSchema.default('container-service'),
  ciMode: ciModeSchema.default('runners'),
  promotionMode: promotionModeSchema.default('approval'),
  dependsOn: applicationFields.dependsOn.default([]),
  paths: applicationFields.paths.default([]),
  repository: repositoryInputSchema.optional(),
  /** Where the application lives inside its repository; "" for the root. */
  path: z.string().max(300).default(''),
});
export const updateApplicationBodySchema = z.object(applicationFields).partial();
export const dependenciesBodySchema = z.object({ dependsOn: applicationFields.dependsOn });

/** What source an application's catalog entry comes from. */
export const catalogSourceSchema = z.enum(['ui', 'repository']);
export const catalogChangeStateSchema = z.enum(['pull_request', 'pending', 'applied', 'discarded']);

/** A UI edit to a repository-backed application: a pull request, or waiting for one. */
export const catalogChangeSchema = z.object({
  id: idSchema,
  application: z.object({ id: idSchema, key: slugSchema, name: z.string() }).nullable(),
  repository: z.string().nullable(),
  kind: z.enum(['create', 'update', 'archive']),
  state: catalogChangeStateSchema,
  /** "Changes owner and tier": what the edit asks for, in words. */
  summary: z.string(),
  changes: z.record(z.string(), z.unknown()),
  pullRequestUrl: z.string().nullable(),
  /** Why it waits: "The code host could not open a pull request". */
  reason: z.string().nullable(),
  createdBy: personRefSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

/** The answer to a write: the application as it now is, and the change waiting, if any. */
export const applicationWriteResultSchema = z.object({
  application: applicationSchema,
  source: catalogSourceSchema,
  change: catalogChangeSchema.nullable(),
});
export const domainWriteResultSchema = domainSchema;
export const groupWriteResultSchema = groupSchema;

export const listCatalogChangesQuerySchema = keysetQuerySchema.extend({
  application: slugSchema.optional(),
  state: catalogChangeStateSchema.optional(),
});
export const catalogChangesPageSchema = keysetPageSchema(catalogChangeSchema);

/* Discovery: one job per repository proposes applications; a platform engineer accepts. */

export const discoverySignalSchema = z.enum([
  'dockerfile',
  'helm',
  'serverless',
  'sam',
  'pnpm-workspace',
  'npm-workspace',
  'nx',
  'turborepo',
  'go-module',
  'cargo',
  'gradle',
  'bazel',
  'backstage',
  'application-yaml',
  'shared-dockerfile',
]);

export const proposalStateSchema = z.enum(['proposed', 'accepted', 'dismissed']);

export const discoveryProposalSchema = z.object({
  id: idSchema,
  repository: z.object({ id: idSchema, fullName: z.string(), url: z.string().nullable() }),
  /** Where the deployable sits in the repository; "" for the root. */
  path: z.string(),
  key: slugSchema,
  name: z.string(),
  description: z.string().nullable(),
  signals: z.array(discoverySignalSchema),
  runtime: runtimeSchema,
  owner: z
    .object({
      team: teamRefSchema.nullable(),
      /** "@acme/payments" as CODEOWNERS or catalog-info.yaml wrote it. */
      raw: z.string(),
      source: z.enum(['codeowners', 'backstage']),
    })
    .nullable(),
  /** From a Backstage system or an existing application.yaml; the person can change it. */
  group: groupPathSchema.nullable(),
  /** The Dockerfile and args it shares with other folders; it then goes in repository.yaml. */
  sharedBuild: z
    .object({
      dockerfile: z.string(),
      context: z.string(),
      args: z.record(z.string(), z.string()),
    })
    .nullable()
    .default(null),
  state: proposalStateSchema,
  applicationKey: slugSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const listProposalsQuerySchema = keysetQuerySchema.extend({
  repository: z.string().max(300).optional(),
  state: proposalStateSchema.default('proposed'),
});
export const proposalsPageSchema = keysetPageSchema(discoveryProposalSchema).extend({
  total: z.number().int(),
  /** The repository file accepting would propose, per repository with shared builds. */
  repositoryFiles: z
    .array(z.object({ repository: z.string(), path: z.string(), content: z.string() }))
    .default([]),
});

export const acceptProposalsBodySchema = z.object({
  items: z
    .array(
      z.object({
        id: idSchema,
        /** Overrides what discovery proposed. */
        group: groupPathSchema.optional(),
        key: slugSchema.optional(),
        owner: applicationFields.owner.optional(),
        tier: tierSchema.optional(),
      }),
    )
    .min(1)
    .max(500),
  /** Used for proposals with no group of their own. */
  group: groupPathSchema.optional(),
  /** Open one pull request per repository adding the application.yaml files. */
  openPullRequests: z.boolean().default(true),
});

export const acceptProposalsResultSchema = z.object({
  created: z.array(z.object({ proposal: idSchema, application: slugSchema })),
  failed: z.array(z.object({ proposal: idSchema, message: z.string() })),
  pullRequests: z.array(
    z.object({ repository: z.string(), url: z.string().nullable(), pending: z.boolean() }),
  ),
});

export const dismissProposalsBodySchema = z.object({ ids: z.array(idSchema).min(1).max(500) });
export const dismissProposalsResultSchema = z.object({ dismissed: z.number().int() });
export const scanResultSchema = z.object({
  repository: z.string(),
  /** Deployables found and proposed (or still proposed) in this scan. */
  proposed: z.number().int(),
  /** Proposals dropped because their folder no longer holds a deployable. */
  removed: z.number().int(),
});

export type CreateDomainBody = z.infer<typeof createDomainBodySchema>;
export type UpdateDomainBody = z.infer<typeof updateDomainBodySchema>;
export type CreateGroupBody = z.infer<typeof createGroupBodySchema>;
export type UpdateGroupBody = z.infer<typeof updateGroupBodySchema>;
export type RepositoryInput = z.infer<typeof repositoryInputSchema>;
export type CreateApplicationBody = z.infer<typeof createApplicationBodySchema>;
export type CreateApplicationInput = z.input<typeof createApplicationBodySchema>;
export type UpdateApplicationBody = z.infer<typeof updateApplicationBodySchema>;
export type DependenciesBody = z.infer<typeof dependenciesBodySchema>;
export type CatalogSource = z.infer<typeof catalogSourceSchema>;
export type CatalogChangeState = z.infer<typeof catalogChangeStateSchema>;
export type CatalogChange = z.infer<typeof catalogChangeSchema>;
export type ApplicationWriteResult = z.infer<typeof applicationWriteResultSchema>;
export type ListCatalogChangesQuery = z.infer<typeof listCatalogChangesQuerySchema>;
export type CatalogChangesPage = z.infer<typeof catalogChangesPageSchema>;
export type DiscoverySignal = z.infer<typeof discoverySignalSchema>;
export type ProposalState = z.infer<typeof proposalStateSchema>;
export type DiscoveryProposal = z.infer<typeof discoveryProposalSchema>;
export type ListProposalsQuery = z.infer<typeof listProposalsQuerySchema>;
export type ProposalsPage = z.infer<typeof proposalsPageSchema>;
export type AcceptProposalsBody = z.infer<typeof acceptProposalsBodySchema>;
export type AcceptProposalsResult = z.infer<typeof acceptProposalsResultSchema>;
export type DismissProposalsBody = z.infer<typeof dismissProposalsBodySchema>;
export type ScanResultBody = z.infer<typeof scanResultSchema>;
