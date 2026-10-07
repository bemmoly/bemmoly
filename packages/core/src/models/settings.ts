import { boolean, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './conventions.ts';

/**
 * Product configuration an admin edits in the UI. A secret row keeps `value`
 * null and stores AES-256-GCM ciphertext in `encrypted`.
 */
export const settings = pgTable(
  'settings',
  {
    id: primaryId(),
    key: text('key').notNull(),
    value: jsonb('value'),
    isSecret: boolean('is_secret').notNull().default(false),
    encrypted: text('encrypted'),
    updatedBy: text('updated_by'),
    ...timestamps(),
  },
  (table) => [uniqueIndex('settings_key_idx').on(table.key)],
);

export type SettingRow = typeof settings.$inferSelect;
