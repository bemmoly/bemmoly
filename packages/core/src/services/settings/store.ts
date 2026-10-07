import { eq } from 'drizzle-orm';
import { isDeepStrictEqual } from 'node:util';
import { createDatabase, type Database } from '../../clients/drizzle.ts';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Actor } from '../../contracts/authz.ts';
import { settings, type SettingRow } from '../../models/settings.ts';
import { recordAudit, type RequestMeta } from '../audit/index.ts';

export interface SettingWrite {
  key: string;
  value: unknown;
  isSecret: boolean;
  encrypted: string | null;
  updatedBy: string;
}

/** Who changed a setting; the store writes the audit row in the change's own transaction. */
export interface SettingAudit {
  actor: Actor;
  meta?: RequestMeta;
  /** The row as the audit log may show it: a secret is only ever "set" or "not set". */
  present(row: SettingRow | undefined): unknown;
}

export interface SettingsStore {
  get(key: string): Promise<SettingRow | undefined>;
  list(): Promise<SettingRow[]>;
  put(write: SettingWrite, audit: SettingAudit): Promise<SettingRow>;
  remove(key: string, audit: SettingAudit): Promise<void>;
}

/** A save that leaves a value as it was is not a change; a new secret always is. */
function changed(previous: SettingRow | undefined, row: SettingRow): boolean {
  return !previous || row.isSecret || !isDeepStrictEqual(previous.value, row.value);
}

async function locked(tx: Database, key: string): Promise<SettingRow | undefined> {
  const [row] = await tx.select().from(settings).where(eq(settings.key, key)).for('update');
  return row;
}

export function createSettingsStore(sql: SqlClient): SettingsStore {
  const db = createDatabase(sql);
  return {
    async get(key) {
      const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
      return row;
    },
    list: () => db.select().from(settings),
    put: (write, audit) =>
      db.transaction(async (tx) => {
        const previous = await locked(tx, write.key);
        const values = {
          key: write.key,
          value: write.isSecret ? null : write.value,
          isSecret: write.isSecret,
          encrypted: write.encrypted,
          updatedBy: write.updatedBy,
        };
        const [row] = await tx
          .insert(settings)
          .values(values)
          .onConflictDoUpdate({
            target: settings.key,
            set: { ...values, updatedAt: new Date() },
          })
          .returning();
        if (!row) throw new Error(`Setting "${write.key}" was not written`);
        if (changed(previous, row)) {
          await recordAudit(tx, {
            actor: audit.actor,
            action: 'setting.updated',
            target: { kind: 'setting', id: write.key },
            before: audit.present(previous),
            after: audit.present(row),
            ...(audit.meta ? { meta: audit.meta } : {}),
          });
        }
        return row;
      }),
    remove: (key, audit) =>
      db.transaction(async (tx) => {
        const previous = await locked(tx, key);
        if (!previous) return;
        await tx.delete(settings).where(eq(settings.key, key));
        await recordAudit(tx, {
          actor: audit.actor,
          action: 'setting.reset',
          target: { kind: 'setting', id: key },
          before: audit.present(previous),
          after: audit.present(undefined),
          ...(audit.meta ? { meta: audit.meta } : {}),
        });
      }),
  };
}
