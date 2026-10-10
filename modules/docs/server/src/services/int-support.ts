import {
  createAuditRecorder,
  createChangelogRunner,
  createContainerMemberships,
  createDatabase,
  createRequestAuthorization,
  createSqlClient,
  loadKernelChangelog,
  loadModules,
  type RealtimeMessage,
  type RequestContext,
  type SqlClient,
} from '@bemmoly/core';
import { createIsolatedDatabase, startTestDatabase } from '@bemmoly/core/testing';
import docs from '../../../module.ts';
import type { Space } from '../../../shared/spaces.ts';
import { createDocsServices, type DocsServiceDeps, type DocsServices } from './index.ts';

/*
 * One real Postgres per integration file: the kernel and Docs changelogs
 * applied from empty (Work is never loaded, as 0.3 asks), four people (an org
 * admin, a space member, a viewer in the space and a member of no space),
 * Docs granted to everyone, and the services wired to a capturing realtime
 * sink so a test can read what would have left the process.
 */

export interface DocsHarness {
  sql: SqlClient;
  services: DocsServices;
  users: { admin: string; member: string; viewer: string; outsider: string };
  realtime: RealtimeMessage[];
  /** A request context for the person, with a fresh per-request authorization. */
  as(userId: string): RequestContext;
  /** A space created by the admin, with the member (member role) and viewer (viewer role) in it. */
  space(key: string): Promise<Space>;
  /** Audit actions recorded so far, oldest first. */
  auditActions(): Promise<string[]>;
  stop(): Promise<void>;
}

export type HarnessStart =
  { available: true; harness: DocsHarness } | { available: false; reason: string };

async function seedPerson(sql: SqlClient, email: string, roleKey: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into users (email, name, role_id)
    select ${email}, ${email.split('@')[0] ?? email}, id from roles where key = ${roleKey}
    returning id`;
  if (!row) throw new Error(`The ${roleKey} role is not seeded`);
  return row.id;
}

export interface HarnessOptions {
  /** What ctx.entities.resolve answers, standing in for Work's issues. */
  entities?: DocsServiceDeps['entities'];
  /** What the comments service publishes notification events through. */
  events?: DocsServiceDeps['events'];
  /** What large imports are queued on. */
  jobs?: DocsServiceDeps['jobs'];
  /** What ctx.links.referencesTo answers, standing in for Work's reference source. */
  links?: DocsServiceDeps['links'];
}

export async function startDocsHarness(options: HarnessOptions = {}): Promise<HarnessStart> {
  const server = await startTestDatabase();
  if (!server.available) return { available: false, reason: server.reason };
  const database = await createIsolatedDatabase(server.url);
  const sql = createSqlClient(database.url, { maxConnections: 12 });
  const runner = createChangelogRunner({
    sql,
    kernel: await loadKernelChangelog(),
    modules: [{ module: 'docs', changelog: docs.changelog }],
    appVersion: '0.2.0',
  });
  await runner.update({ contexts: ['production'] });
  await sql`insert into module_grants (module_id, subject_kind) values ('docs', 'everyone')`;
  const users = {
    admin: await seedPerson(sql, 'ada@example.test', 'org_admin'),
    member: await seedPerson(sql, 'mo@example.test', 'member'),
    viewer: await seedPerson(sql, 'vi@example.test', 'viewer'),
    outsider: await seedPerson(sql, 'otto@example.test', 'member'),
  };
  const catalog = loadModules({ available: [docs], enabled: ['docs'] });
  const db = createDatabase(sql);
  const realtime: RealtimeMessage[] = [];
  const services = createDocsServices({
    database: sql,
    audit: createAuditRecorder(sql),
    memberships: createContainerMemberships(sql),
    realtime: { publish: async (message) => void realtime.push(message) },
    ...(options.entities ? { entities: options.entities } : {}),
    ...(options.events ? { events: options.events } : {}),
    ...(options.jobs ? { jobs: options.jobs } : {}),
    ...(options.links ? { links: options.links } : {}),
  });
  const as = (userId: string): RequestContext => ({
    actor: { kind: 'user', id: userId },
    authz: createRequestAuthorization({ db, modules: catalog }),
  });
  return {
    available: true,
    harness: {
      sql,
      services,
      users,
      realtime,
      as,
      async space(key) {
        const space = await services.spaces.create(as(users.admin), { key, name: key });
        for (const [userId, role] of [
          [users.member, 'member'],
          [users.viewer, 'viewer'],
        ] as const) {
          await sql`
            insert into space_members (space_id, user_id, role_id)
            select ${space.id}, ${userId}, id from roles where key = ${role}
            on conflict (space_id, user_id) do nothing`;
        }
        return space;
      },
      async auditActions() {
        const rows = await sql<
          { action: string }[]
        >`select action from audit_log order by created_at, id`;
        return rows.map((row) => row.action);
      },
      async stop() {
        await sql.end({ timeout: 5 });
        await database.drop();
        await server.stop();
      },
    },
  };
}
