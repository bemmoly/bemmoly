import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, primaryId, timestampTz, updatedAt } from './columns.ts';
import { roles } from './roles.ts';

export const users = pgTable(
  'users',
  {
    id: primaryId(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    avatarKey: text('avatar_key'),
    status: text('status', { enum: ['active', 'invited', 'deactivated'] })
      .notNull()
      .default('active'),
    isBreakGlass: boolean('is_break_glass').notNull().default(false),
    /** The org role; project and space roles live on the membership rows. */
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    themePref: text('theme_pref'),
    locale: text('locale'),
    timezone: text('timezone'),
    /** Bumped on every privilege change; a session on an older version is rotated. */
    privilegeVersion: integer('privilege_version').notNull().default(1),
    lastSeenAt: timestampTz('last_seen_at'),
    deactivatedAt: timestampTz('deactivated_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_email_key').on(sql`lower(${t.email})`),
    index('users_role_id_idx').on(t.roleId),
    check('users_status_check', sql`${t.status} in ('active', 'invited', 'deactivated')`),
  ],
);

/** Configured sign-in methods. Only `password` is implemented; OIDC and SAML fields are reserved. */
export const authProviders = pgTable(
  'auth_providers',
  {
    id: primaryId(),
    kind: text('kind', { enum: ['password', 'oidc', 'saml'] }).notNull(),
    displayName: text('display_name').notNull(),
    configEncrypted: text('config_encrypted'),
    autoProvision: boolean('auto_provision').notNull().default(false),
    defaultRoleId: uuid('default_role_id').references(() => roles.id, { onDelete: 'set null' }),
    groupMappings: jsonb('group_mappings').notNull().default({}),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('auth_providers_password_key')
      .on(t.kind)
      .where(sql`${t.kind} = 'password'`),
    check('auth_providers_kind_check', sql`${t.kind} in ('password', 'oidc', 'saml')`),
  ],
);

/** One row per login method of a person. */
export const authIdentities = pgTable(
  'auth_identities',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => authProviders.id, { onDelete: 'restrict' }),
    subject: text('subject').notNull(),
    /** argon2id, PHC string; only for the password provider. */
    passwordHash: text('password_hash'),
    lastUsedAt: timestampTz('last_used_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('auth_identities_provider_subject_key').on(t.providerId, t.subject),
    index('auth_identities_user_id_idx').on(t.userId),
  ],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestampTz('expires_at').notNull(),
    usedAt: timestampTz('used_at'),
    requestedIp: text('requested_ip'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('password_reset_tokens_token_hash_key').on(t.tokenHash),
    index('password_reset_tokens_user_id_idx').on(t.userId),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type AuthProviderRow = typeof authProviders.$inferSelect;
export type AuthIdentityRow = typeof authIdentities.$inferSelect;
