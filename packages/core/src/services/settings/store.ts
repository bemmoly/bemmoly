import { eq } from 'drizzle-orm';
import { createDatabase } from '../../clients/drizzle.ts';
import type { SqlClient } from '../../clients/postgres.ts';
import { settings, type SettingRow } from '../../models/settings.ts';

export interface SettingWrite {
  key: string;
  value: unknown;
  isSecret: boolean;
  encrypted: string | null;
  updatedBy: string;
}

export interface SettingsStore {
  get(key: string): Promise<SettingRow | undefined>;
  list(): Promise<SettingRow[]>;
  put(write: SettingWrite): Promise<SettingRow>;
  remove(key: string): Promise<void>;
}

export function createSettingsStore(sql: SqlClient): SettingsStore {
  const db = createDatabase(sql);
  return {
    async get(key) {
      const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
      return row;
    },
    list: () => db.select().from(settings),
    async put(write) {
      const values = {
        key: write.key,
        value: write.isSecret ? null : write.value,
        isSecret: write.isSecret,
        encrypted: write.encrypted,
        updatedBy: write.updatedBy,
      };
      const [row] = await db
        .insert(settings)
        .values(values)
        .onConflictDoUpdate({
          target: settings.key,
          set: { ...values, updatedAt: new Date() },
        })
        .returning();
      if (!row) throw new Error(`Setting "${write.key}" was not written`);
      return row;
    },
    async remove(key) {
      await db.delete(settings).where(eq(settings.key, key));
    },
  };
}
