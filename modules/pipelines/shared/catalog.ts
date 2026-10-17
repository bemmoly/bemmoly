import { z } from 'zod';
import {
  ciModeSchema,
  currentStateSchema,
  glyphStateSchema,
  healthSchema,
  idSchema,
  isoDateTimeSchema,
  keysetPageSchema,
  keysetQuerySchema,
  lifecycleSchema,
  promotionModeSchema,
  runtimeSchema,
  slugSchema,
  teamRefSchema,
  tierQuerySchema,
  tierSchema,
} from './common.ts';

/*
 * The catalog: GET /api/v1/pipelines/domains, /groups, /applications and
 * /applications/facets. Lists are keyset pages; facets count what each filter would leave.
 */

/** Epic hue for a domain's tile, as Bemmoly draws tiles; never a hex. */
export const domainColorSchema = z.enum([
  'epic-1',
  'epic-2',
  'epic-3',
  'epic-4',
  'epic-5',
  'epic-6',
  'epic-7',
  'epic-8',
]);

export const domainSchema = z.object({
  id: idSchema,
  key: slugSchema,
  name: z.string(),
  description: z.string().nullable(),
  color: domainColorSchema,
  groupCount: z.number().int(),
  applicationCount: z.number().int(),
});

export const domainRefSchema = z.object({
  id: idSchema,
  key: slugSchema,
  name: z.string(),
  color: domainColorSchema,
});

export const groupSchema = z.object({
  id: idSchema,
  key: slugSchema,
  name: z.string(),
  description: z.string().nullable(),
  domain: domainRefSchema,
  applicationCount: z.number().int(),
});

export const groupRefSchema = z.object({ id: idSchema, key: slugSchema, name: z.string() });

export const repositoryRefSchema = z.object({
  id: idSchema,
  fullName: z.string(),
  url: z.string().nullable(),
  defaultBranch: z.string(),
});

/** The delivery numbers a catalog row and the application header show. */
export const deliverySummarySchema = z.object({
  /** The release in the first Prod environment, and how it is doing there. */
  prodVersion: z.string().nullable(),
  prodState: currentStateSchema.nullable(),
  prodDeployedAt: isoDateTimeSchema.nullable(),
  /** Deploys to Prod per week, oldest first, 12 weeks. */
  deploysByWeek: z.array(z.number().int()).length(12),
  /** Median commit-to-Prod time over 30 days, in seconds. */
  leadTimeSeconds: z.number().int().nullable(),
  /** Share of Prod deploys over 30 days that failed or were rolled back, 0 to 1. */
  changeFailureRate: z.number().min(0).max(1).nullable(),
  /** The last run on the default branch. */
  lastRun: glyphStateSchema.nullable(),
});

export const applicationSchema = z.object({
  id: idSchema,
  key: slugSchema,
  name: z.string(),
  description: z.string().nullable(),
  domain: domainRefSchema,
  group: groupRefSchema,
  ownerTeam: teamRefSchema.nullable(),
  tier: tierSchema,
  labels: z.array(z.string()),
  runtime: runtimeSchema,
  lifecycle: lifecycleSchema,
  ciMode: ciModeSchema,
  promotionMode: promotionModeSchema,
  health: healthSchema,
  repository: repositoryRefSchema.nullable(),
  path: z.string(),
  templateRef: z.string().nullable(),
  lastDeployedAt: isoDateTimeSchema.nullable(),
  delivery: deliverySummarySchema,
});

export const applicationRefSchema = z.object({
  id: idSchema,
  key: slugSchema,
  name: z.string(),
  tier: tierSchema,
});

/** A comma-separated list in a query string: "?tier=0,1", or the key repeated. */
function csv<T extends z.ZodType>(item: T) {
  return z.preprocess(
    (value) =>
      (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
        .map((part) => String(part).trim())
        .filter((part) => part.length > 0),
    z.array(item).max(50),
  );
}

/** The catalog's filters; every one narrows the list and the facet counts the same way. */
export const applicationFiltersSchema = z.object({
  /** Name, key, label or repository; matched anywhere, case-insensitive. */
  q: z.string().trim().max(120).optional(),
  domain: csv(slugSchema).optional(),
  /** "commerce/checkout" or a group key inside the chosen domain. */
  group: csv(z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+)?$/)).optional(),
  team: csv(z.union([idSchema, z.literal('none')])).optional(),
  tier: csv(tierQuerySchema).optional(),
  runtime: csv(runtimeSchema).optional(),
  lifecycle: csv(lifecycleSchema).optional(),
  health: csv(healthSchema).optional(),
  label: csv(z.string().min(1).max(60)).optional(),
  /** Only applications owned by a team the person is in. */
  mine: z.stringbool().optional(),
  /** Not deployed to Prod in this many days (the "Not deployed in 90 days" view). */
  staleDays: z.coerce.number().int().min(1).max(3650).optional(),
});

export const applicationSortSchema = z.enum(['name', 'recent', 'tier']);

export const listApplicationsQuerySchema = keysetQuerySchema.extend({
  ...applicationFiltersSchema.shape,
  sort: applicationSortSchema.default('name'),
});

export const applicationsPageSchema = keysetPageSchema(applicationSchema).extend({
  /** How many match the filters, for "212 of 1,140 applications". */
  total: z.number().int(),
  /** How many exist in the organisation. */
  all: z.number().int(),
});

export const facetValueSchema = z.object({
  value: z.string(),
  label: z.string(),
  count: z.number().int(),
});

/** Counts per value; each facet ignores its own filter so its other values stay pickable. */
export const applicationFacetsSchema = z.object({
  domain: z.array(facetValueSchema),
  team: z.array(facetValueSchema),
  tier: z.array(facetValueSchema),
  runtime: z.array(facetValueSchema),
  lifecycle: z.array(facetValueSchema),
  health: z.array(facetValueSchema),
});

export const listDomainsQuerySchema = z.object({});
export const domainsResponseSchema = z.object({ items: z.array(domainSchema) });

export const listGroupsQuerySchema = keysetQuerySchema.extend({
  domain: slugSchema.optional(),
  q: z.string().trim().max(120).optional(),
});
export const groupsPageSchema = keysetPageSchema(groupSchema);

export const applicationKeyParamsSchema = z.object({ key: slugSchema });
export const domainKeyParamsSchema = z.object({ key: slugSchema });

export type DomainColor = z.infer<typeof domainColorSchema>;
export type Domain = z.infer<typeof domainSchema>;
export type DomainRef = z.infer<typeof domainRefSchema>;
export type Group = z.infer<typeof groupSchema>;
export type GroupRef = z.infer<typeof groupRefSchema>;
export type RepositoryRef = z.infer<typeof repositoryRefSchema>;
export type DeliverySummary = z.infer<typeof deliverySummarySchema>;
export type Application = z.infer<typeof applicationSchema>;
export type ApplicationRef = z.infer<typeof applicationRefSchema>;
export type ApplicationFilters = z.infer<typeof applicationFiltersSchema>;
export type ApplicationSort = z.infer<typeof applicationSortSchema>;
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;
export type ApplicationsPage = z.infer<typeof applicationsPageSchema>;
export type FacetValue = z.infer<typeof facetValueSchema>;
export type ApplicationFacets = z.infer<typeof applicationFacetsSchema>;
export type DomainsResponse = z.infer<typeof domainsResponseSchema>;
export type ListGroupsQuery = z.infer<typeof listGroupsQuerySchema>;
export type GroupsPage = z.infer<typeof groupsPageSchema>;
