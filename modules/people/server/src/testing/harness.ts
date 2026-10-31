import {
  createAuditRecorder,
  createChangelogRunner,
  createCustomFieldsService,
  createDatabase,
  createLocalEventBus,
  createPersonOrgLookup,
  createRequestAuthorization,
  createSqlClient,
  loadKernelChangelog,
  loadModules,
  wireApprovals,
  wirePeople,
  type Actor,
  type JobQueue,
  type ModuleCustomFields,
  type RequestContext,
  type SqlClient,
} from '@bemmoly/core';
import { createIsolatedDatabase, startTestDatabase } from '@bemmoly/core/testing';
import people from '../../../module.ts';
import { startJourneyJob, subscribePeopleEvents } from '../config/events.ts';
import { createPeopleServices, type PeopleServices } from '../services/index.ts';

/*
 * One real Postgres per integration file: the kernel and People changelogs from empty, the
 * kernel's person record, approval engine and custom fields wired as boot wires them, People's
 * event subscriptions on a local bus, and a job queue the test drains by hand.
 */

const ROLES = { admin: 'org_admin', manager: 'member', ana: 'member', ben: 'member' } as const;
export type Who = keyof typeof ROLES;

export interface PeopleHarness {
  sql: SqlClient;
  services: PeopleServices;
  kernel: ReturnType<typeof wirePeople>;
  approvals: ReturnType<typeof wireApprovals>['service'];
  ids: Record<Who, string>;
  actor(who: Who): Actor;
  as(who: Who): RequestContext;
  /** Runs every queued job of People's, as the queue would after commit. */
  drainJobs(): Promise<number>;
  stop(): Promise<void>;
}

export type HarnessStart =
  { available: true; harness: PeopleHarness } | { available: false; reason: string };

function memoryJobs() {
  const handlers = new Map<string, (payload: unknown) => Promise<void>>();
  const queued: { name: string; payload: object; key?: string }[] = [];
  const seen = new Set<string>();
  const queue: JobQueue = {
    register: (name, handler) => void handlers.set(name, handler as never),
    async enqueue(name, payload, options = {}) {
      if (options.key && seen.has(`${name}:${options.key}`)) return null;
      if (options.key) seen.add(`${name}:${options.key}`);
      queued.push({ name, payload, ...(options.key ? { key: options.key } : {}) });
      return `job-${queued.length}`;
    },
  } as JobQueue;
  return { queue, handlers, queued };
}

export async function startPeopleHarness(now?: () => Date): Promise<HarnessStart> {
  const server = await startTestDatabase();
  if (!server.available) return { available: false, reason: server.reason };
  const database = await createIsolatedDatabase(server.url);
  const sql = createSqlClient(database.url, { maxConnections: 8 });
  await createChangelogRunner({
    sql,
    kernel: await loadKernelChangelog(),
    modules: [{ module: 'people', changelog: people.changelog }],
    appVersion: '0.2.0',
  }).update({ contexts: ['production'] });
  await sql`insert into module_grants (module_id, subject_kind) values ('people', 'everyone')`;
  const ids = {} as Record<Who, string>;
  for (const [who, role] of Object.entries(ROLES) as [Who, string][]) {
    const [row] = await sql<{ id: string }[]>`
      insert into users (email, name, role_id)
      select ${`${who}@acme.test`}, ${who}, id from roles where key = ${role} returning id`;
    ids[who] = row!.id;
  }
  const catalog = loadModules({ available: [people], enabled: ['people'] });
  const db = createDatabase(sql);
  const context = (actor: Actor): RequestContext => ({
    actor,
    authz: createRequestAuthorization({ db, modules: catalog }),
  });
  const authorize: Parameters<typeof wirePeople>[0]['authorize'] = (actor, capability, resource) =>
    context(actor).authz.authorize(actor, capability, resource);
  const events = createLocalEventBus();
  const jobs = memoryJobs();
  const kernel = wirePeople({ sql, authorize, events });
  const approvals = wireApprovals({
    sql,
    jobs: jobs.queue,
    events,
    authorize,
    org: createPersonOrgLookup(kernel.directory),
  }).service;
  const fields = createCustomFieldsService({
    sql,
    authorize,
    audit: createAuditRecorder(sql),
    events,
  });
  const scope = (entityType: string) => ({ moduleId: 'people', entityType });
  const customFields: ModuleCustomFields = {
    list: (entityType) => fields.listFields(scope(entityType)),
    create: (actor, entityType, body) =>
      fields.createField(actor, { ...body, ...scope(entityType) }),
    read: (actor, entityType, entityIds) => fields.readValues(actor, scope(entityType), entityIds),
    write: (actor, entityType, id, values, options) =>
      fields.writeValues(actor, scope(entityType), id, values, options),
  };
  const services = createPeopleServices({
    database: sql,
    audit: createAuditRecorder(sql),
    people: kernel.directory,
    approvals,
    customFields,
    events,
    ...(now ? { now } : {}),
  });
  const peopleJobs = {
    send: (name: string, payload?: object, options?: { idempotencyKey?: string }) =>
      jobs.queue.enqueue(
        name,
        payload ?? {},
        options?.idempotencyKey ? { key: options.idempotencyKey } : {},
      ),
  };
  subscribePeopleEvents({ events }, peopleJobs, sql);
  const job = startJourneyJob(services.journeys);
  const actor = (who: Who): Actor => ({ kind: 'user', id: ids[who] });
  return {
    available: true,
    harness: {
      sql,
      services,
      kernel,
      approvals,
      ids,
      actor,
      as: (who) => context(actor(who)),
      async drainJobs() {
        const mine = jobs.queued.filter((entry) => entry.name === job.name);
        for (const entry of mine) jobs.queued.splice(jobs.queued.indexOf(entry), 1);
        for (const entry of mine) await job.handle(entry.payload as never, {} as never);
        return mine.length;
      },
      async stop() {
        await sql.end({ timeout: 5 });
        await database.drop();
        await server.stop();
      },
    },
  };
}
