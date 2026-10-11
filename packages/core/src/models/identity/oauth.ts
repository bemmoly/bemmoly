import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId, timestampTz, updatedAt } from './columns.ts';
import { users } from './users.ts';

/**
 * MCP clients known by their client ID metadata document: the https address is the client id,
 * and the document's name and redirect URIs are cached here until `expires_at`.
 */
export const oauthClients = pgTable(
  'oauth_clients',
  {
    id: primaryId(),
    clientId: text('client_id').notNull(),
    name: text('name').notNull(),
    redirectUris: text('redirect_uris').array().notNull(),
    fetchedAt: timestampTz('fetched_at').notNull(),
    expiresAt: timestampTz('expires_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('oauth_clients_client_id_key').on(t.clientId)],
);

/**
 * One approval on the consent screen, waiting to be exchanged once for tokens. Only the code's
 * sha256 is stored, with the PKCE challenge and everything the token request must repeat.
 */
export const oauthAuthorizationCodes = pgTable(
  'oauth_authorization_codes',
  {
    id: primaryId(),
    codeHash: text('code_hash').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => oauthClients.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    redirectUri: text('redirect_uri').notNull(),
    codeChallenge: text('code_challenge').notNull(),
    resource: text('resource').notNull(),
    scopes: text('scopes').array().notNull(),
    /** Null: every module the person can open. */
    modules: text('modules').array(),
    expiresAt: timestampTz('expires_at').notNull(),
    consumedAt: timestampTz('consumed_at'),
    /** The connection the code became; revoked if the code is ever presented again. */
    grantId: uuid('grant_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('oauth_authorization_codes_code_hash_key').on(t.codeHash),
    index('oauth_authorization_codes_expires_at_idx').on(t.expiresAt),
  ],
);

/** A connected app: one person, one client, one MCP address, what it may do. */
export const oauthGrants = pgTable(
  'oauth_grants',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => oauthClients.id, { onDelete: 'cascade' }),
    resource: text('resource').notNull(),
    scopes: text('scopes').array().notNull(),
    modules: text('modules').array(),
    lastUsedAt: timestampTz('last_used_at'),
    revokedAt: timestampTz('revoked_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('oauth_grants_user_id_idx').on(t.userId),
    index('oauth_grants_client_id_idx').on(t.clientId),
  ],
);

/**
 * Access and refresh tokens of a grant, stored as sha256 only. A refresh token is used once:
 * `consumed_at` marks the rotation, and presenting it again revokes the whole grant.
 */
export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    id: primaryId(),
    grantId: uuid('grant_id')
      .notNull()
      .references(() => oauthGrants.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['access', 'refresh'] }).notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestampTz('expires_at').notNull(),
    consumedAt: timestampTz('consumed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('oauth_tokens_token_hash_key').on(t.tokenHash),
    index('oauth_tokens_grant_id_idx').on(t.grantId),
    index('oauth_tokens_expires_at_idx').on(t.expiresAt),
    check('oauth_tokens_kind_check', sql`${t.kind} in ('access', 'refresh')`),
  ],
);

export type OAuthClientRow = typeof oauthClients.$inferSelect;
export type OAuthAuthorizationCodeRow = typeof oauthAuthorizationCodes.$inferSelect;
export type OAuthGrantRow = typeof oauthGrants.$inferSelect;
export type OAuthTokenRow = typeof oauthTokens.$inferSelect;
