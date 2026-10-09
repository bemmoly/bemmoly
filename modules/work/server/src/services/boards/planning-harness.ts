import {
  createAuditRecorder,
  createChangelogRunner,
  createDatabase,
  createRequestAuthorization,
  createSqlClient,
  loadKernelChangelog,
  type RealtimeMessage,
  type RequestContext,
  type SqlClient,
} from '@bemmoly/core';
import {
  createIsolatedDatabase,
  startTestDatabase,
  type IsolatedDatabase,
  type TestDatabase,
} from '@bemmoly/core/testing';
import type { CreateIssueBody, Issue, WorkMethod } from '../../../../shared/index.ts';
import work from '../../../../module.ts';
import { WORK_CAPABILITIES } from '../../config/capabilities.ts';
import { createWorkServices, type WorkServices } from '../index.ts';
import type { PlanningDeps } from './context.ts';

/*
 * A real Postgres with the kernel and Work changelogs applied, the Work
 * services over it, and the kernel's own authorization, so the planning
 * integration tests check membership and capabilities the way requests do.
 */

export interface Planning {
  sql: SqlClient;
  services: WorkServices;
  /** Every realtime invalidation the services published, in order. */
  messages: RealtimeMessage[];
  /** The dependencies the planning services take, for building one with a fixed clock. */
  deps(now?: () => Date): PlanningDeps;
  ctx(userId: string): RequestContext;
  user(name: string, role?: string): Promise<string>;
  project(key: string, method: WorkMethod, members: [string, string][]): Promise<string>;
  status(name: string): Promise<string>;
  taskType: string;
  issue(
    ctx: RequestContext,
    body: Omit<CreateIssueBody, 'typeId'> & { typeId?: string },
  ): Promise<Issue>;
  /** Moves an issue's status directly, as a fixture; transitions are the workflow's to test. */
  setStatus(key: string, statusName: string): Promise<void>;
  stop(): Promise<void>;
}

export type PlanningStart = { planning: Planning } | { reason: string };

/** `onQuery` sees every statement the services run, for a query-count budget. */
export async function startPlanning(
  options: { onQuery?: (statement: string) => void } = {},
): Promise<PlanningStart> {
  const server: TestDatabase = await startTestDatabase();
  if (!server.available) return { reason: server.reason };
  const database: IsolatedDatabase = await createIsolatedDatabase(server.url);
  const sql = createSqlClient(database.url, {
    maxConnections: 8,
    ...(options.onQuery ? { onQuery: options.onQuery } : {}),
  });
  const runner = createChangelogRunner({
    sql,
    kernel: await loadKernelChangelog(),
    modules: [{ module: 'work', changelog: work.changelog }],
    appVersion: '0.2.0',
  });
  await runner.update({ contexts: ['production'] });
  await sql`insert into module_grants (module_id, subject_kind) values ('work', 'everyone')`;

  const messages: RealtimeMessage[] = [];
  const realtime = { publish: async (message: RealtimeMessage) => void messages.push(message) };
  const events = { publish: async () => undefined, subscribe: () => () => undefined };
  const audit = createAuditRecorder(sql);
  const services = createWorkServices({ database: sql, realtime, events, audit });
  const db = createDatabase(sql);
  const modules = {
    ids: () => ['work'],
    capabilities: () =>
      WORK_CAPABILITIES.map((capability) => ({ ...capability, moduleId: 'work' })),
  };
  const [task] = await sql<{ id: string }[]>`
    select id from issue_types where project_id is null and key = 'task'`;

  const planning: Planning = {
    sql,
    services,
    messages,
    taskType: task?.id ?? '',
    deps: (now) => ({
      database: sql,
      realtime,
      events,
      audit,
      workflow: services.workflow.gate,
      lql: services.lql,
      ...(now ? { now } : {}),
    }),
    ctx: (userId) => ({
      actor: { kind: 'user', id: userId },
      authz: createRequestAuthorization({ db, modules }),
    }),
    async user(name, role = 'member') {
      const [row] = await sql<{ id: string }[]>`
        insert into users (email, name, role_id)
        select ${`${name.toLowerCase()}@acme.test`}, ${name}, id from roles where key = ${role}
        returning id`;
      return row?.id ?? '';
    },
    async project(key, method, members) {
      const [row] = await sql<{ id: string }[]>`
        insert into projects (key, name, method) values (${key}, ${key}, ${method}) returning id`;
      const projectId = row?.id ?? '';
      for (const [userId, role] of members) {
        await sql`
          insert into project_members (project_id, user_id, role_id)
          select ${projectId}, ${userId}, id from roles where key = ${role}`;
      }
      return projectId;
    },
    async status(name) {
      const [row] = await sql<{ id: string }[]>`
        select s.id from workflow_statuses s join workflows w on w.id = s.workflow_id
        where w.project_id is null and s.name = ${name}`;
      return row?.id ?? '';
    },
    issue: (ctx, body) => services.issues.create(ctx, { typeId: task?.id ?? '', ...body }),
    async setStatus(key, statusName) {
      const statusId = await planning.status(statusName);
      await sql`
        update issues set status_id = ${statusId}, status_changed_at = now(), updated_at = now()
        where key = ${key}`;
    },
    async stop() {
      await sql.end({ timeout: 5 });
      await database.drop();
      await server.stop();
    },
  };
  return { planning };
}
