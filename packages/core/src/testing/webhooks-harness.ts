/**
 * Integration-test wiring for outgoing webhooks: a real Postgres with the kernel changelog,
 * the real authorization over seeded roles, a fake job queue the test drains by hand, a
 * local event bus, a controllable clock and a local receiver. Test-only.
 */
import { createDatabase } from '../clients/drizzle.ts';
import { createSqlClient, type SqlClient } from '../clients/postgres.ts';
import { createWebhookClient } from '../clients/webhook-http.ts';
import type { Actor } from '../contracts/authz.ts';
import type { DomainEvent, EventBus } from '../contracts/event-bus.ts';
import { createLocalEventBus } from '../modules/local-event-bus.ts';
import { createAuthorize } from '../services/authz/index.ts';
import { createSecretBox } from '../services/settings/index.ts';
import { wireWebhooks, type Webhooks, type WebhooksWiring } from '../services/webhooks/index.ts';
import { fakeJobQueue, silentLogger, TEST_SECRET_KEY, type FakeJobQueue } from './fakes.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from './isolated-database.ts';
import { applyKernelChangelog } from './kernel-changelog.ts';
import type { TestDatabase } from './postgres.ts';
import { startWebhookReceiver, type WebhookReceiver } from './webhook-receiver.ts';

export const WEBHOOKS_PUBLIC_URL = 'https://bemmoly.example.com';

export interface WebhooksWired extends Webhooks {
  jobs: FakeJobQueue;
  events: EventBus;
  /** Every event published on this wiring's bus, in order. */
  published: DomainEvent[];
}

export interface WebhooksHarness {
  sql: SqlClient;
  receiver: WebhookReceiver;
  clock: { now: Date };
  admin: Actor;
  member: Actor;
  adminId: string;
  /** A wiring on its own queue and bus; `allowPrivateUrls` defaults to true for the receiver. */
  wire(
    options?: Partial<Pick<WebhooksWiring, 'allowPrivateUrls' | 'tuning'>> & {
      timeoutMs?: number;
    },
  ): WebhooksWired;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

async function addUser(sql: SqlClient, role: string, email: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into users (email, name, role_id)
    select ${email}, ${email.split('@')[0] ?? email}, id from roles where key = ${role}
    returning id`;
  return row!.id;
}

export async function startWebhooksHarness(
  database: Extract<TestDatabase, { available: true }>,
): Promise<WebhooksHarness> {
  const isolated: IsolatedDatabase = await createIsolatedDatabase(database.url);
  const sql = createSqlClient(isolated.url, { maxConnections: 5 });
  await applyKernelChangelog(sql);
  const authorize = createAuthorize({
    db: createDatabase(sql),
    modules: { ids: () => [], capabilities: () => [] },
  });
  const adminId = await addUser(sql, 'org_admin', 'rohan@acme.test');
  const memberId = await addUser(sql, 'member', 'aisha@acme.test');
  const receiver = await startWebhookReceiver();
  const clock = { now: new Date('2026-10-11T09:00:00.000Z') };
  const wirings: WebhooksWired[] = [];
  return {
    sql,
    receiver,
    clock,
    adminId,
    admin: { kind: 'user', id: adminId, userId: adminId },
    member: { kind: 'user', id: memberId, userId: memberId },
    wire(options = {}) {
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
      const allowPrivateUrls = options.allowPrivateUrls ?? true;
      const wired = wireWebhooks({
        sql,
        jobs,
        events,
        authorize,
        secrets: createSecretBox(TEST_SECRET_KEY),
        publicUrl: WEBHOOKS_PUBLIC_URL,
        allowPrivateUrls,
        logger: silentLogger,
        client: createWebhookClient({
          policy: allowPrivateUrls ? 'any' : 'public',
          timeoutMs: options.timeoutMs ?? 5_000,
        }),
        tuning: { now: () => clock.now, ...options.tuning },
      });
      const result = { ...wired, jobs, events, published };
      wirings.push(result);
      return result;
    },
    async reset() {
      for (const wired of wirings) wired.stop();
      wirings.length = 0;
      await sql`truncate webhooks cascade`;
      receiver.received.length = 0;
      receiver.answers.length = 0;
      receiver.fallback = { status: 200, body: 'ok' };
    },
    async stop() {
      for (const wired of wirings) wired.stop();
      await receiver.close();
      await sql.end({ timeout: 5 });
      await isolated.drop();
    },
  };
}
