import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId, timestampTz, updatedAt } from './columns.ts';
import { authProviders, users } from './users.ts';

/**
 * One sign-in through an identity provider, from the redirect out to the session. The browser
 * holds a binding cookie whose digest is stored here, so a response replayed into another
 * browser cannot finish the flow there.
 */
export const authSsoFlows = pgTable(
  'auth_sso_flows',
  {
    id: primaryId(),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => authProviders.id, { onDelete: 'cascade' }),
    stateHash: text('state_hash').notNull(),
    bindingHash: text('binding_hash').notNull(),
    /** The nonce and PKCE verifier (OIDC), sealed with the install's secret key. */
    secretsEncrypted: text('secrets_encrypted').notNull(),
    /** The AuthnRequest id a SAML response must answer. */
    requestId: text('request_id'),
    returnTo: text('return_to').notNull(),
    /** Set for a test sign-in started from Settings: nobody is signed in, the result is kept. */
    testUserId: uuid('test_user_id').references(() => users.id, { onDelete: 'cascade' }),
    /** The verified identity, between a SAML POST and the same-site GET that finishes it. */
    result: jsonb('result'),
    expiresAt: timestampTz('expires_at').notNull(),
    consumedAt: timestampTz('consumed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('auth_sso_flows_state_hash_key').on(t.stateHash),
    index('auth_sso_flows_expires_at_idx').on(t.expiresAt),
    index('auth_sso_flows_provider_id_idx').on(t.providerId),
  ],
);

/** SAML assertion ids already accepted, kept until the assertion would have expired anyway. */
export const authSsoAssertions = pgTable(
  'auth_sso_assertions',
  {
    id: primaryId(),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => authProviders.id, { onDelete: 'cascade' }),
    assertionId: text('assertion_id').notNull(),
    expiresAt: timestampTz('expires_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('auth_sso_assertions_provider_assertion_key').on(t.providerId, t.assertionId),
    index('auth_sso_assertions_expires_at_idx').on(t.expiresAt),
  ],
);

/** Bearer tokens an identity provider uses to provision people over SCIM. */
export const scimTokens = pgTable(
  'scim_tokens',
  {
    id: primaryId(),
    name: text('name').notNull(),
    prefix: text('prefix').notNull(),
    tokenHash: text('token_hash').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    lastUsedAt: timestampTz('last_used_at'),
    revokedAt: timestampTz('revoked_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('scim_tokens_token_hash_key').on(t.tokenHash)],
);

/** The identity provider's externalId for a person or team provisioned over SCIM. */
export const scimResources = pgTable(
  'scim_resources',
  {
    id: primaryId(),
    resourceType: text('resource_type', { enum: ['user', 'group'] }).notNull(),
    resourceId: uuid('resource_id').notNull(),
    externalId: text('external_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('scim_resources_type_resource_key').on(t.resourceType, t.resourceId),
    index('scim_resources_type_external_idx').on(t.resourceType, t.externalId),
    check('scim_resources_resource_type_check', sql`${t.resourceType} in ('user', 'group')`),
  ],
);

export type AuthSsoFlowRow = typeof authSsoFlows.$inferSelect;
export type ScimTokenRow = typeof scimTokens.$inferSelect;
