import { z } from 'zod';

/** `read` allows GET and HEAD; `write` allows every method. Capabilities still apply on top. */
export const API_TOKEN_SCOPES = ['read', 'write'] as const;

export const apiTokenScopeSchema = z.enum(API_TOKEN_SCOPES);

export const createApiTokenSchema = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(apiTokenScopeSchema).min(1).max(API_TOKEN_SCOPES.length),
  expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
});

export const apiTokenSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** First characters of the secret, so a person can tell tokens apart. */
  prefix: z.string(),
  scopes: z.array(apiTokenScopeSchema),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
});

export const apiTokensResponseSchema = z.object({ items: z.array(apiTokenSchema) });

/** The secret appears in this response only; it is stored as a hash. */
export const createdApiTokenSchema = z.object({
  token: z.string(),
  apiToken: apiTokenSchema,
});

export type ApiTokenScope = z.infer<typeof apiTokenScopeSchema>;
export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>;
export type ApiToken = z.infer<typeof apiTokenSchema>;
export type ApiTokensResponse = z.infer<typeof apiTokensResponseSchema>;
export type CreatedApiToken = z.infer<typeof createdApiTokenSchema>;
