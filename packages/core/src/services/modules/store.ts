import { eq } from 'drizzle-orm';
import { createDatabase, type Database } from '../../clients/drizzle.ts';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Actor } from '../../contracts/authz.ts';
import { modules, type ModuleRow } from '../../models/modules.ts';
import { recordAudit, type RequestMeta } from '../audit/index.ts';

export type ModuleStatePatch = Partial<Omit<ModuleRow, 'id' | 'createdAt' | 'updatedAt'>>;

/** An admin's change to a module, audited in the same transaction as the state it writes. */
export interface ModuleAudit {
  actor: Actor;
  action: 'module.enabled' | 'module.disabled' | 'module.data_removed';
  meta?: RequestMeta;
  /** Facts about the change beyond the state, such as how many changesets were reversed. */
  details?: Record<string, unknown>;
}

/** Where module enabled state lives: the modules table, or memory without a database. */
export interface ModuleStateStore {
  list(): Promise<ModuleRow[]>;
  /** With `audit`, the audit row commits with the state; without, the write is bookkeeping. */
  upsert(id: string, patch: ModuleStatePatch, audit?: ModuleAudit): Promise<ModuleRow>;
}

/** What the audit log shows of a module's state. */
function presentModule(row: ModuleRow | undefined) {
  if (!row) return null;
  return {
    enabled: row.enabled,
    versionInstalled: row.versionInstalled,
    changelogState: row.changelogState,
    dataRemovedAt: row.dataRemovedAt,
  };
}

export function createModuleStateStore(sql: SqlClient): ModuleStateStore {
  const db = createDatabase(sql);
  async function write(executor: Database, id: string, patch: ModuleStatePatch) {
    const [row] = await executor
      .insert(modules)
      .values({ id, ...patch })
      .onConflictDoUpdate({ target: modules.id, set: { ...patch, updatedAt: new Date() } })
      .returning();
    if (!row) throw new Error(`Module state for "${id}" was not written`);
    return row;
  }
  return {
    list: () => db.select().from(modules),
    async upsert(id, patch, audit) {
      if (!audit) return write(db, id, patch);
      return db.transaction(async (tx) => {
        const [previous] = await tx.select().from(modules).where(eq(modules.id, id)).for('update');
        const row = await write(tx, id, patch);
        await recordAudit(tx, {
          actor: audit.actor,
          action: audit.action,
          target: { kind: 'module', id },
          before: presentModule(previous),
          after: { ...presentModule(row), ...audit.details },
          ...(audit.meta ? { meta: audit.meta } : {}),
        });
        return row;
      });
    },
  };
}

/** For processes without DATABASE_URL and for tests: state lasts as long as the process. */
export function createMemoryModuleStateStore(): ModuleStateStore {
  const rows = new Map<string, ModuleRow>();
  return {
    list: async () => [...rows.values()],
    async upsert(id, patch) {
      const now = new Date();
      const previous = rows.get(id);
      const row: ModuleRow = {
        id,
        enabled: false,
        enabledAt: null,
        disabledAt: null,
        dataRemovedAt: null,
        versionInstalled: null,
        changelogState: 'pending',
        createdAt: previous?.createdAt ?? now,
        ...previous,
        ...patch,
        updatedAt: now,
      };
      rows.set(id, row);
      return row;
    },
  };
}

/** Enabled ids straight from the table, for tools that run outside the server. */
export async function readEnabledModuleIds(sql: SqlClient): Promise<string[]> {
  const [exists] = await sql<{ present: boolean }[]>`
    select to_regclass('modules') is not null as present`;
  if (!exists?.present) return [];
  const rows = await sql<{ id: string }[]>`select id from modules where enabled order by id`;
  return rows.map((row) => row.id);
}
