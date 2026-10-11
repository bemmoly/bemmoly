import { z } from 'zod';
import { moduleIdSchema } from '../../modules/index.ts';

/*
 * OAuth for the MCP server (MCP authorization spec 2025-11-25): an MCP client identifies itself
 * with a client ID metadata document (an https URL), the person signs in and approves on the
 * consent screen, and the client gets a short-lived access token bound to the MCP server and a
 * rotating refresh token. A connection is a grant, listed and revoked under Access tokens.
 */

/** Read is search and read; write adds the module tools that change things. */
export const OAUTH_SCOPE_READ = 'mcp:read';
export const OAUTH_SCOPE_WRITE = 'mcp:write';
/** `module:work` limits a connection to one module; none listed means every module. */
export const OAUTH_MODULE_SCOPE_PREFIX = 'module:';

export const OAUTH_ACCESS_LEVELS = ['read', 'write'] as const;
export const oauthAccessSchema = z.enum(OAUTH_ACCESS_LEVELS);

const unreservedChallenge = /^[A-Za-z0-9._~-]{43,128}$/;

/**
 * The authorization request's query, exactly as the client put it in the address. The consent
 * screen sends it back unchanged; the server validates it on every call.
 */
export const oauthAuthorizeRequestSchema = z.object({
  response_type: z.string().max(64),
  client_id: z.string().min(1).max(2048),
  redirect_uri: z.string().min(1).max(2048),
  code_challenge: z.string().max(256).optional(),
  code_challenge_method: z.string().max(16).optional(),
  scope: z.string().max(2048).optional(),
  state: z.string().max(2048).optional(),
  resource: z.string().max(2048).optional(),
});

export const pkceChallengeSchema = z.string().regex(unreservedChallenge);

export const oauthClientSummarySchema = z.object({
  /** The client's id: the address of its metadata document. */
  id: z.string(),
  name: z.string(),
  /** Where the metadata document lives, which vouches for the name. */
  host: z.string(),
  /** Where the browser goes after the decision. */
  redirectUri: z.string(),
  redirectHost: z.string(),
  /** The redirect goes to an app on this computer (localhost), which no domain vouches for. */
  loopback: z.boolean(),
});

export const oauthModuleOptionSchema = z.object({ id: moduleIdSchema, name: z.string() });

/** What the consent screen shows: the client, and the most it may be given. */
export const oauthAuthorizationPreviewSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ready'),
    client: oauthClientSummarySchema,
    /** The highest access the client asked for; the person may give less. */
    access: oauthAccessSchema,
    /** The modules the client asked for; null for every module the person can open. */
    requestedModules: z.array(moduleIdSchema).nullable(),
    /** The modules the person may choose from: exposed over MCP and open to them. */
    moduleOptions: z.array(oauthModuleOptionSchema),
  }),
  z.object({
    /** The request is malformed, but the client and its redirect are known: go back there. */
    status: z.literal('invalid'),
    client: oauthClientSummarySchema,
    error: z.string(),
    description: z.string(),
    redirectUrl: z.string(),
  }),
]);

export const createOAuthConsentSchema = z.object({
  request: oauthAuthorizeRequestSchema,
  approve: z.boolean(),
  /** Defaults to what the client asked for; never more. */
  access: oauthAccessSchema.optional(),
  /** Null for every module; otherwise a subset of the options. */
  modules: z.array(moduleIdSchema).min(1).max(32).nullable().optional(),
});

/** Where the browser goes next: back to the client, with a code or with access_denied. */
export const oauthConsentResultSchema = z.object({ redirectUrl: z.string() });

export const oauthGrantSchema = z.object({
  id: z.uuid(),
  client: z.object({ id: z.string(), name: z.string(), host: z.string() }),
  access: oauthAccessSchema,
  /** Null: every module the person can open. */
  modules: z.array(z.string()).nullable(),
  /** The MCP address the connection may reach. */
  resource: z.string(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const oauthGrantsResponseSchema = z.object({ items: z.array(oauthGrantSchema) });

const verifierSchema = z.string().regex(unreservedChallenge);
const clientIdField = z.string().min(1).max(2048);

/** The token endpoint's form (RFC 6749 4.1.3 and 6), for public clients: no secret, PKCE. */
export const oauthTokenRequestSchema = z.discriminatedUnion('grant_type', [
  z.object({
    grant_type: z.literal('authorization_code'),
    code: z.string().min(1).max(512),
    redirect_uri: z.string().min(1).max(2048),
    client_id: clientIdField,
    code_verifier: verifierSchema,
    resource: z.string().max(2048).optional(),
  }),
  z.object({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string().min(1).max(512),
    client_id: clientIdField,
    resource: z.string().max(2048).optional(),
    scope: z.string().max(2048).optional(),
  }),
]);

/** RFC 7009: the client hands back a token it no longer needs. */
export const oauthRevokeRequestSchema = z.object({
  token: z.string().min(1).max(512),
  token_type_hint: z.string().max(64).optional(),
  client_id: clientIdField.optional(),
});

export type OAuthTokenRequest = z.infer<typeof oauthTokenRequestSchema>;
export type OAuthRevokeRequest = z.infer<typeof oauthRevokeRequestSchema>;
export type OAuthAccess = z.infer<typeof oauthAccessSchema>;
export type OAuthAuthorizeRequest = z.infer<typeof oauthAuthorizeRequestSchema>;
export type OAuthClientSummary = z.infer<typeof oauthClientSummarySchema>;
export type OAuthModuleOption = z.infer<typeof oauthModuleOptionSchema>;
export type OAuthAuthorizationPreview = z.infer<typeof oauthAuthorizationPreviewSchema>;
export type CreateOAuthConsentInput = z.infer<typeof createOAuthConsentSchema>;
export type OAuthConsentResult = z.infer<typeof oauthConsentResultSchema>;
export type OAuthGrant = z.infer<typeof oauthGrantSchema>;
export type OAuthGrantsResponse = z.infer<typeof oauthGrantsResponseSchema>;
