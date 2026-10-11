import { createHash } from 'node:crypto';
import type { SqlClient } from '../../clients/postgres.ts';
import type {
  ImportMappingStore,
  ImportPerson,
  ImportRunContext,
} from '../../contracts/importer.ts';

/** Where a placeholder with no address at the source gets one that can never receive mail. */
const PLACEHOLDER_DOMAIN = 'placeholder.invalid';

const clip = (value: string, max: number) => value.trim().slice(0, max);

/**
 * People at the source become Bemmoly users by email. Someone with an address and no account
 * is added as invited (no email is sent; an admin invites them when ready); someone whose
 * address the source hides becomes a deactivated placeholder that keeps their name on what
 * they wrote. Both are mapped, so a re-run finds the same person.
 */
export function createPeopleMatcher(
  sql: SqlClient,
  mappings: ImportMappingStore,
  report: ImportRunContext['report'],
): ImportRunContext['users'] {
  const cache = new Map<string, string | null>();
  let memberRoleId: string | null = null;

  async function roleId(): Promise<string> {
    if (memberRoleId) return memberRoleId;
    const [row] = await sql<{ id: string }[]>`select id from roles where key = 'member'`;
    if (!row) throw new Error('The member role is missing');
    memberRoleId = row.id;
    return row.id;
  }

  async function resolve(person: ImportPerson): Promise<string | null> {
    const mapped = await mappings.get('user', person.sourceId);
    if (mapped) {
      const [still] = await sql`select 1 from users where id = ${mapped.targetId}`;
      if (still) return mapped.targetId;
    }
    const email = person.email?.trim().toLowerCase() || null;
    const name = clip(person.name || email || '', 200);
    if (!email && !name) return null;
    if (email) {
      const [existing] = await sql<{ id: string }[]>`
        select id from users where lower(email) = ${email}`;
      if (existing) {
        await mappings.set('user', person.sourceId, existing.id, { matched: true });
        report.count('users', 'updated');
        return existing.id;
      }
    }
    const digest = createHash('sha256').update(person.sourceId).digest('hex').slice(0, 16);
    const address = email ?? `import-${digest}@${PLACEHOLDER_DOMAIN}`;
    const [created] = await sql<{ id: string }[]>`
      insert into users (email, name, status, role_id, deactivated_at)
      values (${address}, ${name || address}, ${email ? 'invited' : 'deactivated'},
        ${await roleId()}, ${email ? null : sql`now()`})
      on conflict (lower(email)) do update set updated_at = users.updated_at
      returning id`;
    if (!created) throw new Error('A placeholder person was not stored');
    await mappings.set('user', person.sourceId, created.id, { placeholder: true });
    report.count('users', 'created');
    return created.id;
  }

  return {
    async match(person) {
      if (cache.has(person.sourceId)) return cache.get(person.sourceId) ?? null;
      const id = await resolve(person);
      cache.set(person.sourceId, id);
      return id;
    },
  };
}
