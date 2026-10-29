import {
  createChangelogRunner,
  createDatabase,
  createRequestAuthorization,
  createSqlClient,
  loadKernelChangelog,
  loadModules,
  type RequestContext,
  type SqlClient,
} from '@bemmoly/core';
import { createIsolatedDatabase, startTestDatabase } from '@bemmoly/core/testing';
import pipelines from '../../../module.ts';
import { createFakeWorld, type FakeWorld } from '../services/providers/fake/index.ts';
import { createDefaultProviders } from '../services/providers/index.ts';
import { createProviderRegistry } from '../services/providers/registry.ts';
import { createPipelinesServices, type PipelinesServices } from '../services/index.ts';

/*
 * One real Postgres per integration file: the kernel and Pipelines changelogs applied from
 * empty, three people (an org admin, a member granted Pipelines and an outsider who is not),
 * and the Pipelines services wired as the module wires them.
 */

export interface PipelinesHarness {
  sql: SqlClient;
  services: PipelinesServices;
  users: { admin: string; member: string; outsider: string };
  /** The simulated cloud behind every provider call, so tests can inspect and steer it. */
  world: FakeWorld;
  /** Jobs the services queued, in order, instead of running them. */
  jobs: SentJob[];
  as(userId: string): RequestContext;
  stop(): Promise<void>;
}

export interface SentJob {
  name: string;
  payload: Record<string, unknown>;
  idempotencyKey: string | undefined;
}

export type HarnessStart =
  { available: true; harness: PipelinesHarness } | { available: false; reason: string };

async function seedPerson(sql: SqlClient, email: string, name: string, role: string) {
  const [row] = await sql<{ id: string }[]>`
    insert into users (email, name, role_id)
    select ${email}, ${name}, id from roles where key = ${role}
    returning id`;
  if (!row) throw new Error(`The ${role} role is not seeded`);
  return row.id;
}

export async function startPipelinesHarness(): Promise<HarnessStart> {
  const server = await startTestDatabase();
  if (!server.available) return { available: false, reason: server.reason };
  const database = await createIsolatedDatabase(server.url);
  const sql = createSqlClient(database.url, { maxConnections: 12 });
  const runner = createChangelogRunner({
    sql,
    kernel: await loadKernelChangelog(),
    modules: [{ module: 'pipelines', changelog: pipelines.changelog }],
    appVersion: '0.1.0',
  });
  await runner.update({ contexts: ['production'] });
  const users = {
    admin: await seedPerson(sql, 'ada@example.test', 'Ada Admin', 'org_admin'),
    member: await seedPerson(sql, 'priya@example.test', 'Priya Sharma', 'member'),
    outsider: await seedPerson(sql, 'otto@example.test', 'Otto Outside', 'member'),
  };
  // Pipelines is granted to the admin and the member, never to the outsider.
  await sql`
    insert into module_grants (module_id, subject_kind, subject_id)
    values ('pipelines', 'user', ${users.admin}), ('pipelines', 'user', ${users.member})`;
  const modules = loadModules({ available: [pipelines], enabled: ['pipelines'] });
  const db = createDatabase(sql);
  const world = createFakeWorld();
  const registry = createProviderRegistry(
    createDefaultProviders({ simulate: true, local: true, world }),
  );
  const jobs: SentJob[] = [];
  const services = createPipelinesServices({
    database: sql,
    providers: registry,
    async sendJob(name, payload, options = {}) {
      jobs.push({ name, payload, idempotencyKey: options.idempotencyKey });
      return `job-${jobs.length}`;
    },
  });
  const as = (userId: string): RequestContext => ({
    actor: { kind: 'user', id: userId },
    authz: createRequestAuthorization({ db, modules }),
  });
  return {
    available: true,
    harness: {
      sql,
      services,
      users,
      world,
      jobs,
      as,
      async stop() {
        await sql.end({ timeout: 5 });
        await database.drop();
        await server.stop();
      },
    },
  };
}
