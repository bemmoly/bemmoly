import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId, updatedAt } from './columns.ts';
import { users } from './users.ts';

/** Layer one of authorization: who may see a module at all. */
export const moduleGrants = pgTable(
  'module_grants',
  {
    id: primaryId(),
    moduleId: text('module_id').notNull(),
    subjectKind: text('subject_kind', { enum: ['everyone', 'team', 'role', 'user'] }).notNull(),
    /** A team, role or user id; null for everyone. */
    subjectId: uuid('subject_id'),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('module_grants_subject_key')
      .on(t.moduleId, t.subjectKind, t.subjectId)
      .nullsNotDistinct(),
    index('module_grants_subject_idx').on(t.subjectKind, t.subjectId),
    check(
      'module_grants_subject_check',
      sql`${t.subjectKind} in ('everyone', 'team', 'role', 'user') and ((${t.subjectKind} = 'everyone') = (${t.subjectId} is null))`,
    ),
  ],
);

export type ModuleGrantRow = typeof moduleGrants.$inferSelect;
