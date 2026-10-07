import { sql } from 'drizzle-orm';
import { index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId, timestampTz, updatedAt } from './columns.ts';
import { roles } from './roles.ts';
import { users } from './users.ts';

/** Teams own projects and spaces; SSO groups map onto them. */
export const teams = pgTable(
  'teams',
  {
    id: primaryId(),
    name: text('name').notNull(),
    color: text('color'),
    leadUserId: uuid('lead_user_id').references(() => users.id, { onDelete: 'set null' }),
    defaultRoleId: uuid('default_role_id').references(() => roles.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('teams_name_key').on(sql`lower(${t.name})`)],
);

export const teamMembers = pgTable(
  'team_members',
  {
    id: primaryId(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('team_members_team_user_key').on(t.teamId, t.userId),
    index('team_members_user_id_idx').on(t.userId),
  ],
);

export const invitations = pgTable(
  'invitations',
  {
    id: primaryId(),
    email: text('email').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
    tokenHash: text('token_hash').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestampTz('expires_at').notNull(),
    acceptedAt: timestampTz('accepted_at'),
    acceptedUserId: uuid('accepted_user_id').references(() => users.id, { onDelete: 'set null' }),
    revokedAt: timestampTz('revoked_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('invitations_token_hash_key').on(t.tokenHash),
    index('invitations_pending_email_idx')
      .on(sql`lower(${t.email})`)
      .where(sql`${t.acceptedAt} is null and ${t.revokedAt} is null`),
  ],
);

export type TeamRow = typeof teams.$inferSelect;
export type TeamMemberRow = typeof teamMembers.$inferSelect;
export type InvitationRow = typeof invitations.$inferSelect;
