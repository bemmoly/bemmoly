/**
 * Integration-test wiring for the approval engine: a real Postgres with the kernel changelog,
 * the real authorization over seeded roles, a fake job queue the test drains by hand, a bus
 * that records every event, a controllable clock and an org chart the test fills. Test-only.
 */
import { createDatabase } from '../clients/drizzle.ts';
import { createSqlClient, type SqlClient } from '../clients/postgres.ts';
import type { OrgLookup } from '../contracts/approvals.ts';
import type { Actor } from '../contracts/authz.ts';
import type { DomainEvent, EventBus } from '../contracts/event-bus.ts';
import { createLocalEventBus } from '../modules/local-event-bus.ts';
import { wireApprovals, type ApprovalsWired } from '../services/approvals/index.ts';
import { createAuthorize } from '../services/authz/index.ts';
import { fakeJobQueue, type FakeJobQueue } from './fakes.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from './isolated-database.ts';
import { applyKernelChangelog } from './kernel-changelog.ts';
import type { TestDatabase } from './postgres.ts';

export const PEOPLE = ['admin', 'requester', 'manager', 'director', 'finance', 'delegate'] as const;

export type Person = (typeof PEOPLE)[number];

export interface ApprovalsHarness extends ApprovalsWired {
  sql: SqlClient;
  jobs: FakeJobQueue;
  published: DomainEvent[];
  clock: { now: Date };
  ids: Record<Person, string>;
  as(person: Person): Actor;
  /** Who manages whom, and who owns which cost centre; empty after each reset. */
  org: { managers: Map<string, string>; owners: Map<string, string> };
  reset(): Promise<void>;
  stop(): Promise<void>;
}

const ROLE: Record<Person, string> = {
  admin: 'org_admin',
  requester: 'member',
  manager: 'member',
  director: 'member',
  finance: 'project_admin',
  delegate: 'member',
};

export async function startApprovalsHarness(
  database: Extract<TestDatabase, { available: true }>,
): Promise<ApprovalsHarness> {
  const isolated: IsolatedDatabase = await createIsolatedDatabase(database.url);
  const sql = createSqlClient(isolated.url, { maxConnections: 5 });
  await applyKernelChangelog(sql);
  const authorize = createAuthorize({
    db: createDatabase(sql),
    modules: { ids: () => [], capabilities: () => [] },
  });
  const ids = {} as Record<Person, string>;
  for (const person of PEOPLE) {
    const [row] = await sql<{ id: string }[]>`
      insert into users (email, name, role_id)
      select ${`${person}@acme.test`}, ${person}, id from roles where key = ${ROLE[person]}
      returning id`;
    ids[person] = row!.id;
  }
  const org = { managers: new Map<string, string>(), owners: new Map<string, string>() };
  const lookup: OrgLookup = {
    async managerChain(userId, levels) {
      const chain: string[] = [];
      for (
        let at = org.managers.get(userId);
        at && chain.length < levels;
        at = org.managers.get(at)
      ) {
        chain.push(at);
      }
      return chain;
    },
    costCentreOwner: async (context) => org.owners.get(String(context.fields.costCentre)) ?? null,
  };
  const jobs = fakeJobQueue();
  const bus = createLocalEventBus();
  const published: DomainEvent[] = [];
  const events: EventBus = {
    async publish(event) {
      published.push(event);
      await bus.publish(event);
    },
    subscribe: (kind, handler) => bus.subscribe(kind, handler),
  };
  const clock = { now: new Date('2026-10-22T09:00:00.000Z') };
  const wired = wireApprovals({ sql, jobs, events, authorize, org: lookup, now: () => clock.now });
  return {
    ...wired,
    sql,
    jobs,
    published,
    clock,
    ids,
    org,
    as: (person) => ({ kind: 'user', id: ids[person], userId: ids[person] }),
    async reset() {
      await sql`truncate approval_workflows, approval_delegations cascade`;
      await sql`truncate approval_requests cascade`;
      await sql`update users set status = 'active'`;
      jobs.queued.length = 0;
      published.length = 0;
      org.managers.clear();
      org.owners.clear();
      clock.now = new Date('2026-10-22T09:00:00.000Z');
    },
    async stop() {
      await sql.end({ timeout: 5 });
      await isolated.drop();
    },
  };
}
