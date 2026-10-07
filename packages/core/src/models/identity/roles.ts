import { boolean, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId, updatedAt } from './columns.ts';

/** Org roles: the five system roles from the People mock plus custom ones. */
export const roles = pgTable(
  'roles',
  {
    id: primaryId(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('roles_key_key').on(t.key)],
);

/** The capability matrix. A missing row falls back to the capability's declared default. */
export const roleCapabilities = pgTable(
  'role_capabilities',
  {
    id: primaryId(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    capability: text('capability').notNull(),
    allowed: boolean('allowed').notNull(),
    /** Only org admins may change a locked row; project and space overrides may not touch it. */
    lockedByOrg: boolean('locked_by_org').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('role_capabilities_role_capability_key').on(t.roleId, t.capability)],
);

export type RoleRow = typeof roles.$inferSelect;
export type RoleCapabilityRow = typeof roleCapabilities.$inferSelect;
