import { createDatabase } from '../../clients/drizzle.ts';
import type { SqlClient } from '../../clients/postgres.ts';
import { modules, type ModuleRow } from '../../models/modules.ts';

export type ModuleStatePatch = Partial<Omit<ModuleRow, 'id' | 'createdAt' | 'updatedAt'>>;

/** Where module enabled state lives: the modules table, or memory without a database. */
export interface ModuleStateStore {
  list(): Promise<ModuleRow[]>;
  upsert(id: string, patch: ModuleStatePatch): Promise<ModuleRow>;
}

export function createModuleStateStore(sql: SqlClient): ModuleStateStore {
  const db = createDatabase(sql);
  return {
    list: () => db.select().from(modules),
    async upsert(id, patch) {
      const [row] = await db
        .insert(modules)
        .values({ id, ...patch })
        .onConflictDoUpdate({ target: modules.id, set: { ...patch, updatedAt: new Date() } })
        .returning();
      if (!row) throw new Error(`Module state for "${id}" was not written`);
      return row;
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
