import { z } from 'zod';
import { aiCatalogSourceSchema, aiRoleSchema } from './enums.ts';

/**
 * One model in the trimmed models.dev shape. Field names follow the catalog (snake_case)
 * because this is its data, stored and served as it came.
 */
export const catalogModelSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  family: z.string().optional(),
  attachment: z.boolean().optional(),
  reasoning: z.boolean().optional(),
  tool_call: z.boolean().optional(),
  structured_output: z.boolean().optional(),
  temperature: z.boolean().optional(),
  release_date: z.string().optional(),
  last_updated: z.string().optional(),
  open_weights: z.boolean().optional(),
  status: z.string().optional(),
  modalities: z
    .object({ input: z.array(z.string()), output: z.array(z.string()) })
    .partial()
    .optional(),
  limit: z
    .object({ context: z.number().nonnegative(), output: z.number().nonnegative() })
    .partial()
    .optional(),
  /** USD per million tokens. */
  cost: z
    .object({
      input: z.number().nonnegative(),
      output: z.number().nonnegative(),
      cache_read: z.number().nonnegative(),
      cache_write: z.number().nonnegative(),
    })
    .partial()
    .optional(),
});
export type CatalogModel = z.infer<typeof catalogModelSchema>;

export const catalogProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  /** Credential and setting names the provider package reads, in the catalog's order. */
  env: z.array(z.string()).default([]),
  /** The AI SDK package that talks to it. */
  npm: z.string().default(''),
  /** Base URL, when the provider needs one. */
  api: z.string().optional(),
  doc: z.string().default(''),
  models: z.record(z.string(), catalogModelSchema).default({}),
});
export type CatalogProvider = z.infer<typeof catalogProviderSchema>;

/** The whole catalog as models.dev serves it: provider id → provider. */
export const catalogDataSchema = z.record(z.string(), catalogProviderSchema);
export type CatalogData = z.infer<typeof catalogDataSchema>;

/** Which catalog the picker shows and how fresh it is; `line` is the status line verbatim. */
export const aiCatalogStatusSchema = z.object({
  /** Where the data came from: a live fetch, an admin's upload, or the copy in the image. */
  source: aiCatalogSourceSchema,
  /** False only when this very resolution reached models.dev (or reused a fetch within the hour). */
  offline: z.boolean(),
  fetchedAt: z.iso.datetime().nullable(),
  /** The Bemmoly version a bundled catalog shipped with. */
  bundledWith: z.string().nullable(),
  /** "Live · models.dev · updated 4 minutes ago", "Offline · last fetched 2 October 2026". */
  line: z.string(),
  liveFetch: z.boolean(),
  providerCount: z.number().int().nonnegative(),
  modelCount: z.number().int().nonnegative(),
});
export type AiCatalogStatus = z.infer<typeof aiCatalogStatusSchema>;

/**
 * How the runtime will load a provider: its own package from the bundled allow-list, or the
 * generic compatible client over its listed base URL (the UI says so).
 */
export const aiLoaderKindSchema = z.enum(['package', 'compatible']);
export type AiLoaderKind = z.infer<typeof aiLoaderKindSchema>;

export const aiCatalogProviderSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  env: z.array(z.string()),
  api: z.string().nullable(),
  doc: z.string(),
  npm: z.string(),
  loader: aiLoaderKindSchema,
  modelCount: z.number().int().nonnegative(),
  /** Served at GET /api/v1/admin/ai/catalog/logos/:id; null when none is bundled or cached. */
  logoUrl: z.string().nullable(),
});
export type AiCatalogProviderSummary = z.infer<typeof aiCatalogProviderSummarySchema>;

/** GET /api/v1/admin/ai/catalog: the picker's data. */
export const aiCatalogResponseSchema = z.object({
  status: aiCatalogStatusSchema,
  /** Catalog ids for the Popular row, in order; a UI ordering, not code. */
  popular: z.array(z.string()),
  providers: z.array(aiCatalogProviderSummarySchema),
});
export type AiCatalogResponse = z.infer<typeof aiCatalogResponseSchema>;

/** A model as the role picker lists it, with which roles it qualifies for. */
export const aiCatalogModelEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  family: z.string().nullable(),
  toolCall: z.boolean(),
  structuredOutput: z.boolean(),
  reasoning: z.boolean(),
  attachment: z.boolean(),
  contextWindow: z.number().int().nonnegative().nullable(),
  maxOutput: z.number().int().nonnegative().nullable(),
  inputCostPerMillion: z.number().nonnegative().nullable(),
  outputCostPerMillion: z.number().nonnegative().nullable(),
  releaseDate: z.string().nullable(),
  deprecated: z.boolean(),
  eligibleRoles: z.array(aiRoleSchema),
  suggestedFor: z.array(aiRoleSchema),
});
export type AiCatalogModelEntry = z.infer<typeof aiCatalogModelEntrySchema>;

/** GET /api/v1/admin/ai/catalog/providers/:id */
export const aiCatalogProviderResponseSchema = z.object({
  provider: aiCatalogProviderSummarySchema,
  models: z.array(aiCatalogModelEntrySchema),
});
export type AiCatalogProviderResponse = z.infer<typeof aiCatalogProviderResponseSchema>;

/** POST /api/v1/admin/ai/catalog-snapshots: an admin uploads a models.dev api.json. */
export const aiCatalogUploadBodySchema = z.object({ data: catalogDataSchema });
export type AiCatalogUploadBody = z.infer<typeof aiCatalogUploadBodySchema>;
