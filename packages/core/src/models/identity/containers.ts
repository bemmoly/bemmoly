import { boolean, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId, updatedAt } from './columns.ts';
import { roles } from './roles.ts';
import { users } from './users.ts';

/*
 * Container membership and overrides for projects (Work) and spaces (Docs).
 * The kernel owns these tables so authorization has one home; the foreign keys
 * to projects and spaces arrive with the modules that create those tables.
 */

export const projectMembers = pgTable(
  'project_members',
  {
    id: primaryId(),
    projectId: uuid('project_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('project_members_project_user_key').on(t.projectId, t.userId),
    index('project_members_user_id_idx').on(t.userId),
  ],
);

export const spaceMembers = pgTable(
  'space_members',
  {
    id: primaryId(),
    spaceId: uuid('space_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('space_members_space_user_key').on(t.spaceId, t.userId),
    index('space_members_user_id_idx').on(t.userId),
  ],
);

/** Project-level overrides; they may only narrow the org matrix and never touch a locked row. */
export const projectRoleCapabilities = pgTable(
  'project_role_capabilities',
  {
    id: primaryId(),
    projectId: uuid('project_id').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    capability: text('capability').notNull(),
    allowed: boolean('allowed').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('project_role_capabilities_key').on(t.projectId, t.roleId, t.capability)],
);

export const spaceRoleCapabilities = pgTable(
  'space_role_capabilities',
  {
    id: primaryId(),
    spaceId: uuid('space_id').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    capability: text('capability').notNull(),
    allowed: boolean('allowed').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('space_role_capabilities_key').on(t.spaceId, t.roleId, t.capability)],
);
