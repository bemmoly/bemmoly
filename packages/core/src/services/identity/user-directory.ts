import { inArray } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import type { UserDirectory } from '../../contracts/users.ts';
import { users } from '../../models/identity/index.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read-only lookup for services that address people, such as notifications. */
export function createUserDirectory(db: Database): UserDirectory {
  return {
    async findByIds(ids) {
      const wanted = [...new Set(ids.filter((id) => UUID.test(id)))];
      if (wanted.length === 0) return [];
      const rows = await db
        .select({ id: users.id, email: users.email, name: users.name, status: users.status })
        .from(users)
        .where(inArray(users.id, wanted));
      return rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        active: row.status === 'active',
      }));
    },
  };
}
