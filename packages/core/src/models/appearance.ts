import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps, timestamptz } from './conventions.ts';

/**
 * Custom themes (ADR 0021): a brand colour and a surface style; the light and dark sets are
 * generated from them, never stored. `owner_id` is null for a workspace theme and the person
 * for a personal one.
 */
export const customThemes = pgTable(
  'custom_themes',
  {
    id: primaryId(),
    name: text('name').notNull(),
    brandColor: text('brand_color').notNull(),
    surface: text('surface').notNull().default('neutral'),
    ownerId: uuid('owner_id'),
    createdBy: uuid('created_by'),
    ...timestamps(),
  },
  (table) => [
    check('custom_themes_name_check', sql`char_length(${table.name}) between 1 and 40`),
    check('custom_themes_brand_color_check', sql`${table.brandColor} ~ '^#[0-9a-f]{6}$'`),
    check('custom_themes_surface_check', sql`${table.surface} in ('neutral', 'warm')`),
    index('custom_themes_owner_idx').on(table.ownerId, table.id),
  ],
);

/** A person's own mode and theme; a missing row or a null column means the workspace's. */
export const userAppearancePreferences = pgTable(
  'user_appearance_preferences',
  {
    userId: uuid('user_id').primaryKey(),
    mode: text('mode'),
    theme: text('theme'),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    check(
      'user_appearance_preferences_mode_check',
      sql`${table.mode} is null or ${table.mode} in ('light', 'dark', 'system')`,
    ),
  ],
);

export type CustomThemeRow = typeof customThemes.$inferSelect;
