import {
  createAuditRecorder,
  createChangelogRunner,
  createContainerMemberships,
  createDatabase,
  createRequestAuthorization,
  createSqlClient,
  loadKernelChangelog,
  loadModules,
  type DomainEvent,
  type RealtimeMessage,
  type RequestContext,
  type SqlClient,
} from '@bemmoly/core';
import { createIsolatedDatabase, startTestDatabase } from '@bemmoly/core/testing';
import work from '../../../module.ts';
import type { CreateIssueBody, Issue } from '../../../shared/issues.ts';
import type { Project } from '../../../shared/projects.ts';
import { createWorkServices, type WorkServices } from './index.ts';

/*
 * One real Postgres per integration file: the kernel and Work changelogs
 * applied from empty, three people (an org admin, a project member and a
 * member of no project), Work granted to everyone, and the Work services
 * wired to capturing event, realtime and job sinks so a test can read what
 * would have left the process.
 */

export interface SentJob {
  name: string;
  payload: Record<string, unknown> | undefined;
}

export interface WorkHarness {
  sql: SqlClient;
  services: WorkServices;
  users: { admin: string; member: string; outsider: string };
  events: DomainEvent[];
  realtime: RealtimeMessage[];
  jobs: SentJob[];
  /** A request context for the person, with a fresh per-request authorization. */
  as(userId: string): RequestContext;
  /** A project created by the admin, with `members` added in the member role. */
  project(key: string, members?: readonly string[]): Promise<Project>;
  /** A task in the project, created by `userId` (the admin when omitted). */
  issue(
    project: Project,
    title: string,
    extra?: Partial<CreateIssueBody>,
    userId?: string,
  ): Promise<Issue>;
  stop(): Promise<void>;
}

export type HarnessStart =
  { available: true; harness: WorkHarness } | { available: false; reason: string };

async function seedPerson(sql: SqlClient, email: string, roleKey: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into users (email, name, role_id)
    select ${email}, ${email.split('@')[0] ?? email}, id from roles where key = ${roleKey}
    returning id`;
  if (!row) throw new Error(`The ${roleKey} role is not seeded`);
  return row.id;
}

export async function startWorkHarness(): Promise<HarnessStart> {
  const server = await startTestDatabase();
  if (!server.available) return { available: false, reason: server.reason };
  const database = await createIsolatedDatabase(server.url);
  const sql = createSqlClient(database.url, { maxConnections: 24 });
  const runner = createChangelogRunner({
    sql,
    kernel: await loadKernelChangelog(),
    modules: [{ module: 'work', changelog: work.changelog }],
    appVersion: '0.2.0',
  });
  await runner.update({ contexts: ['production'] });
  await sql`insert into module_grants (module_id, subject_kind) values ('work', 'everyone')`;
  const users = {
    admin: await seedPerson(sql, 'ada@example.test', 'org_admin'),
    member: await seedPerson(sql, 'mo@example.test', 'member'),
    outsider: await seedPerson(sql, 'otto@example.test', 'member'),
  };
  const catalog = loadModules({ available: [work], enabled: ['work'] });
  const db = createDatabase(sql);
  const events: DomainEvent[] = [];
  const realtime: RealtimeMessage[] = [];
  const jobs: SentJob[] = [];
  const services = createWorkServices({
    database: sql,
    audit: createAuditRecorder(sql),
    memberships: createContainerMemberships(sql),
    events: { publish: async (event) => void events.push(event), subscribe: () => () => undefined },
    realtime: { publish: async (message) => void realtime.push(message) },
    jobs: {
      add: () => undefined,
      send: async (name, payload) => {
        jobs.push({ name, payload });
        return name;
      },
    },
  });
  const as = (userId: string): RequestContext => ({
    actor: { kind: 'user', id: userId },
    authz: createRequestAuthorization({ db, modules: catalog }),
  });
  const [task] = await sql<{ id: string }[]>`
    select id from issue_types where project_id is null and key = 'task'`;
  if (!task) throw new Error('The default task type is not seeded');
  return {
    available: true,
    harness: {
      sql,
      services,
      users,
      events,
      realtime,
      jobs,
      as,
      async project(key, members = []) {
        const project = await services.projects.create(as(users.admin), { key, name: key });
        for (const userId of members) {
          await sql`
            insert into project_members (project_id, user_id, role_id)
            select ${project.id}, ${userId}, id from roles where key = 'member'
            on conflict (project_id, user_id) do nothing`;
        }
        return project;
      },
      issue(project, title, extra = {}, userId = users.admin) {
        return services.issues.create(as(userId), {
          projectId: project.id,
          typeId: task.id,
          title,
          ...extra,
        });
      },
      async stop() {
        await sql.end({ timeout: 5 });
        await database.drop();
        await server.stop();
      },
    },
  };
}
