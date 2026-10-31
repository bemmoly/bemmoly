/**
 * Integration-test wiring for the person record: a real Postgres with the kernel changelog,
 * the real authorization over seeded roles and an event bus that keeps what it was given.
 * Test-only.
 */
import { createDatabase } from '../clients/drizzle.ts';
import { createSqlClient, type SqlClient } from '../clients/postgres.ts';
import type { Actor } from '../contracts/authz.ts';
import type { DomainEvent, EventBus } from '../contracts/event-bus.ts';
import { createLocalEventBus } from '../modules/local-event-bus.ts';
import { createAuthorize } from '../services/authz/index.ts';
import { wirePeople, type People } from '../services/people/index.ts';
import { createIsolatedDatabase } from './isolated-database.ts';
import { applyKernelChangelog } from './kernel-changelog.ts';
import type { TestDatabase } from './postgres.ts';

export interface PeopleHarness extends People {
  sql: SqlClient;
  events: EventBus;
  /** Every event published, in order, with whether its transaction was passed along. */
  published: DomainEvent[];
  admin: Actor;
  member: Actor;
  adminId: string;
  memberId: string;
  /** A new user with the Member role; returns the user id. */
  addUser(name: string): Promise<string>;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

export async function startPeopleHarness(
  database: Extract<TestDatabase, { available: true }>,
): Promise<PeopleHarness> {
  const isolated = await createIsolatedDatabase(database.url);
  const sql = createSqlClient(isolated.url, { maxConnections: 5 });
  await applyKernelChangelog(sql);
  const authorize = createAuthorize({
    db: createDatabase(sql),
    modules: { ids: () => [], capabilities: () => [] },
  });
  const insertUser = async (name: string, role: string) => {
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@acme.test`;
    const [row] = await sql<{ id: string }[]>`
      insert into users (email, name, role_id)
      select ${email}, ${name}, id from roles where key = ${role}
      returning id`;
    return row!.id;
  };
  const adminId = await insertUser('Rohan Admin', 'org_admin');
  const memberId = await insertUser('Aisha Member', 'member');
  const bus = createLocalEventBus();
  const published: DomainEvent[] = [];
  const events: EventBus = {
    async publish(event) {
      published.push(event);
      await bus.publish(event);
    },
    subscribe: (kind, handler) => bus.subscribe(kind, handler),
  };
  const people = wirePeople({ sql, authorize, events, now: () => new Date('2026-10-22T09:00Z') });
  return {
    ...people,
    sql,
    events,
    published,
    adminId,
    memberId,
    admin: { kind: 'user', id: adminId, userId: adminId },
    member: { kind: 'user', id: memberId, userId: memberId },
    addUser: (name) => insertUser(name, 'member'),
    async reset() {
      await sql`delete from people`;
      await sql`delete from locations`;
      await sql`delete from cost_centres`;
      await sql`delete from users where id not in (${adminId}, ${memberId})`;
      await sql`delete from teams`;
      published.length = 0;
    },
    async stop() {
      await sql.end({ timeout: 5 });
      await isolated.drop();
    },
  };
}
