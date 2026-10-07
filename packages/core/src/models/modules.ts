import { boolean, pgTable, text } from 'drizzle-orm/pg-core';
import { timestamps, timestamptz } from './conventions.ts';

export const MODULE_CHANGELOG_STATES = ['pending', 'current', 'failed', 'removed'] as const;

/**
 * One row per module this install has seen. Keyed by the module id, which is
 * already stable and unique, and is what schema_changelog.module refers to.
 */
export const modules = pgTable('modules', {
  id: text('id').primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  enabledAt: timestamptz('enabled_at'),
  disabledAt: timestamptz('disabled_at'),
  dataRemovedAt: timestamptz('data_removed_at'),
  versionInstalled: text('version_installed'),
  changelogState: text('changelog_state', { enum: MODULE_CHANGELOG_STATES })
    .notNull()
    .default('pending'),
  ...timestamps(),
});

export type ModuleRow = typeof modules.$inferSelect;
