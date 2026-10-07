/**
 * Integration-test wiring for email and notifications: a real Postgres with the
 * whole kernel changelog applied from empty by the runner, in-memory fakes for
 * the contracts other services own, and a Fastify app with the routes mounted.
 * Test-only; not exported.
 */
import { isBemmolyError, NotFoundError, ProviderError, ValidationError } from '@bemmoly/shared';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { createSqlClient, type SqlClient } from '../clients/postgres.ts';
import type { Actor } from '../contracts/authz.ts';
import type { EventBus } from '../contracts/event-bus.ts';
import type { DirectoryUser } from '../contracts/users.ts';
import { createLocalEventBus } from '../modules/local-event-bus.ts';
import { emailNotificationRoutes } from '../routes/email-notifications.routes.ts';
import { createMemoryMailbox, type MailboxStore } from '../services/email/index.ts';
import {
  wireEmailNotifications,
  type EmailNotifications,
} from '../services/notifications/index.ts';
import {
  fakeAuthorize,
  fakeDirectory,
  fakeJobQueue,
  fakeRealtime,
  fakeSettings,
  silentLogger,
  TEST_SECRET_KEY,
  type FakeJobQueue,
  type FakeRealtime,
  type FakeSettings,
} from './fakes.ts';
import { createIsolatedDatabase } from './isolated-database.ts';
import { applyKernelChangelog } from './kernel-changelog.ts';
import type { TestDatabase } from './postgres.ts';

/** The email and notification changesets, last in the kernel changelog. */
export const EMAIL_CHANGESET_IDS = [
  '0200-email-outbox',
  '0201-notifications',
  '0202-notification-preferences',
];

export const PUBLIC_URL = 'https://bemmoly.example.com';

export interface Harness {
  sql: SqlClient;
  users: DirectoryUser[];
  settings: FakeSettings;
  jobs: FakeJobQueue;
  realtime: FakeRealtime;
  events: EventBus;
  mailbox: MailboxStore;
  wired: EmailNotifications;
  app: FastifyInstance;
  /** Inserts a Member into the users table and the directory. */
  addUser(name: string, email: string): Promise<DirectoryUser>;
  stop(): Promise<void>;
}

/** Shapes errors like the host's handler, enough for status-code assertions. */
function testErrorHandler(error: unknown, request: FastifyRequest) {
  const status = isBemmolyError(error)
    ? error instanceof NotFoundError
      ? 404
      : error instanceof ValidationError
        ? 400
        : error instanceof ProviderError
          ? 502
          : error.code === 'forbidden'
            ? 403
            : 500
    : ((error as { statusCode?: number }).statusCode ?? 500);
  return { status, body: { message: (error as Error).message, requestId: request.id } };
}

export async function startHarness(
  database: Extract<TestDatabase, { available: true }>,
  adminIds: () => readonly string[],
): Promise<Harness> {
  const isolated = await createIsolatedDatabase(database.url);
  const sql = createSqlClient(isolated.url, { maxConnections: 5 });
  await applyKernelChangelog(sql);
  const users: DirectoryUser[] = [];
  const settings = fakeSettings();
  const jobs = fakeJobQueue();
  const realtime = fakeRealtime();
  const events = createLocalEventBus();
  const mailbox = createMemoryMailbox();
  const wired = wireEmailNotifications({
    env: {
      BEMMOLY_PUBLIC_URL: PUBLIC_URL,
      BEMMOLY_SECRET_KEY: TEST_SECRET_KEY,
      BEMMOLY_ALLOW_PRIVATE_URLS: true,
    },
    sql,
    settings,
    jobs,
    realtime,
    events,
    users: fakeDirectory(users),
    authorize: async (actor, capability, resource) =>
      fakeAuthorize(adminIds())(actor, capability, resource),
    authenticate: async (request): Promise<Actor> => {
      const id = request.headers['x-test-user'];
      if (typeof id !== 'string') throw Object.assign(new Error('Sign in'), { statusCode: 401 });
      return { kind: 'user', id, userId: id };
    },
    logger: silentLogger,
    mailbox,
    txtLookup: async (name) => (name.endsWith('acme.test') ? ['v=spf1 mx ~all'] : []),
  });
  const app = Fastify();
  app.setErrorHandler(async (error, request, reply) => {
    const { status, body } = testErrorHandler(error, request);
    return reply.code(status).send(body);
  });
  await app.register(emailNotificationRoutes(wired.routes), { prefix: '/api/v1' });
  await app.ready();

  return {
    sql,
    users,
    settings,
    jobs,
    realtime,
    events,
    mailbox,
    wired,
    app,
    async addUser(name, email) {
      const [row] = await sql<{ id: string }[]>`
        insert into users (email, name, role_id)
        select ${email}, ${name}, id from roles where key = 'member'
        returning id`;
      const user = { id: row?.id ?? '', name, email, active: true };
      users.push(user);
      return user;
    },
    async stop() {
      wired.stop();
      await app.close();
      await sql.end({ timeout: 5 });
      await isolated.drop();
    },
  };
}
