import { z } from 'zod';
import { aiLoaderKindSchema } from './catalog.ts';
import { aiCustomProtocolSchema } from './enums.ts';

/** A model a custom endpoint reported, with what one probe request each found it can do. */
export const aiDiscoveredModelSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  toolCall: z.boolean().nullable(),
  structuredOutput: z.boolean().nullable(),
  embedding: z.boolean(),
  contextWindow: z.number().int().positive().nullable(),
});
export type AiDiscoveredModel = z.infer<typeof aiDiscoveredModelSchema>;

export const AI_PROVIDER_STATUSES = ['unchecked', 'ok', 'failed'] as const;
export const aiProviderStatusSchema = z.enum(AI_PROVIDER_STATUSES);
export type AiProviderStatus = z.infer<typeof aiProviderStatusSchema>;

/**
 * A connected provider as the API returns it. Credentials are write-only: the response says
 * which credential names are set, never their values.
 */
export const aiProviderSchema = z.object({
  id: z.uuid(),
  /** A models.dev provider id, or "custom" for a Local server endpoint. */
  catalogId: z.string(),
  name: z.string(),
  protocol: aiCustomProtocolSchema.nullable(),
  baseUrl: z.string().nullable(),
  loader: aiLoaderKindSchema,
  /** Credential names that hold a value; the values never leave the server. */
  credentialsSet: z.array(z.string()),
  headersSet: z.array(z.string()),
  /** Discovered (custom) or entered models; catalog providers list theirs from the catalog. */
  models: z.array(aiDiscoveredModelSchema),
  isDefault: z.boolean(),
  status: aiProviderStatusSchema,
  lastCheckedAt: z.iso.datetime().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AiProvider = z.infer<typeof aiProviderSchema>;

export const aiProviderListResponseSchema = z.object({ items: z.array(aiProviderSchema) });
export type AiProviderListResponse = z.infer<typeof aiProviderListResponseSchema>;

const credentialName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'A credential name');
const secretValue = z.string().min(1).max(8192);
const headerName = z.string().regex(/^[A-Za-z0-9-]+$/, 'A header name');
const baseUrl = z.url({ protocol: /^https?$/ }).max(2048);

/** POST /api/v1/admin/ai/providers: connect a catalog provider. */
export const aiCatalogProviderCreateSchema = z.object({
  kind: z.literal('catalog'),
  catalogId: z.string().min(1).max(128),
  name: z.string().min(1).max(120).optional(),
  baseUrl: baseUrl.optional(),
  /** One value per name the catalog's env list asks for. */
  credentials: z.record(credentialName, secretValue).default({}),
  headers: z.record(headerName, secretValue).default({}),
  isDefault: z.boolean().optional(),
});

/** POST /api/v1/admin/ai/providers: connect a Local server (custom endpoint). */
export const aiCustomProviderCreateSchema = z.object({
  kind: z.literal('custom'),
  protocol: aiCustomProtocolSchema,
  name: z.string().min(1).max(120),
  baseUrl,
  apiKey: secretValue.optional(),
  headers: z.record(headerName, secretValue).default({}),
  isDefault: z.boolean().optional(),
});

export const aiProviderCreateBodySchema = z.discriminatedUnion('kind', [
  aiCatalogProviderCreateSchema,
  aiCustomProviderCreateSchema,
]);
export type AiProviderCreateBody = z.infer<typeof aiProviderCreateBodySchema>;

/**
 * PATCH /api/v1/admin/ai/providers/:id. Credentials and headers merge by name: a string sets
 * one, null clears it, an absent name keeps what is stored.
 */
export const aiProviderUpdateBodySchema = z
  .object({
    name: z.string().min(1).max(120),
    baseUrl: baseUrl.nullable(),
    credentials: z.record(credentialName, secretValue.nullable()),
    headers: z.record(headerName, secretValue.nullable()),
    isDefault: z.boolean(),
  })
  .partial();
export type AiProviderUpdateBody = z.infer<typeof aiProviderUpdateBodySchema>;

/** POST /api/v1/admin/ai/providers/:id/test: one cheap call, reported in plain words. */
export const aiProviderTestResponseSchema = z.object({
  ok: z.boolean(),
  /** "Connected · answered in 412 ms", or the provider's own error in plain words. */
  message: z.string(),
  latencyMs: z.number().int().nonnegative().nullable(),
  model: z.string().nullable(),
  /** How many models the provider reported, when it lists them. */
  modelsFound: z.number().int().nonnegative().nullable(),
  checkedAt: z.iso.datetime(),
});
export type AiProviderTestResponse = z.infer<typeof aiProviderTestResponseSchema>;

/** POST /api/v1/admin/ai/providers/:id/discover: a custom endpoint's models, probed. */
export const aiProviderDiscoverResponseSchema = z.object({
  models: z.array(aiDiscoveredModelSchema),
  checkedAt: z.iso.datetime(),
});
export type AiProviderDiscoverResponse = z.infer<typeof aiProviderDiscoverResponseSchema>;

/** POST /api/v1/admin/ai/provider-tests: test values before saving them (the wizard). */
export const aiProviderDraftTestBodySchema = aiProviderCreateBodySchema;
export type AiProviderDraftTestBody = AiProviderCreateBody;
