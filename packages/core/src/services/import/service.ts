import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type CreateImportBody,
  type ImportContainerQuery,
  type ImportCountBody,
  type ImportPeopleQuery,
  type ImportPlannedJob,
  type ImportTargetQuery,
  type RunImportBody,
  type ImportSelectionBody,
  type ImportJob,
  type ImportSource,
  type UpdateImportBody,
} from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type { AuditRecorder } from '../../contracts/audit.ts';
import type { Actor, Authorize } from '../../contracts/authz.ts';
import type { ImportSourceContext } from '../../contracts/importer.ts';
import type { JobQueue } from '../../contracts/jobs.ts';
import type { SecretBox } from '../settings/index.ts';
import { createChooser } from './choose.ts';
import { buildPlan } from './plan.ts';
import { listPeople } from './people-plan.ts';
import { queueRun } from './run-queue.ts';
import { skipsCsv } from './skips.ts';
import { openConnection, splitConnection } from './connection.ts';
import { containerRefs, insertContainers, listContainers, saveCounts } from './containers.ts';
import { preselect, selectExactly, SMALL_SITE } from './selection.ts';
import { describeSource, type ImporterCatalog } from './define.ts';
import { createMappingStore } from './mappings.ts';
import { insertJob, jobById, listJobs, toImportJob, type ImportJobRow } from './store.ts';

export interface ImportServiceDeps {
  sql: SqlClient;
  catalog: ImporterCatalog;
  authorize: Authorize;
  secrets: SecretBox;
  jobs: JobQueue;
  audit: AuditRecorder;
  fetchFor: ImportSourceContext['fetchFor'];
}

const workspace = { kind: 'workspace' } as const;
/** Importing writes across modules and stores credentials: a workspace settings change. */
const CAPABILITY = 'workspace.settings.manage';
/** How long discovery and planning may talk to a source inside one request. */
const REQUEST_BUDGET_MS = 60_000;
const ACTIVE = new Set(['queued', 'running']);

const userIdOf = (actor: Actor) => actor.userId ?? (actor.kind === 'user' ? actor.id : null);

/**
 * Settings › Import: the sources enabled modules offer, a connection tested and counted
 * (discover), a selection turned into a plan with its mappings, a run queued as a job, and
 * cancel. Every call is an admin's; credentials go in sealed and never come back out.
 */
export function createImportService(deps: ImportServiceDeps) {
  const { sql, catalog } = deps;

  const present = (row: ImportJobRow): ImportJob =>
    toImportJob(row, catalog.get(row.source)?.importer.label ?? row.source);

  function importerFor(source: string) {
    const entry = catalog.get(source);
    if (!entry) throw new NotFoundError(`No enabled module imports from ${source}`);
    return entry.importer;
  }

  const sourceContext = (): ImportSourceContext => ({
    signal: AbortSignal.timeout(REQUEST_BUDGET_MS),
    fetchFor: deps.fetchFor,
  });

  const chooser = createChooser({
    sql,
    secrets: deps.secrets,
    importerFor,
    sourceContext,
  });

  async function audit(actor: Actor, action: string, row: ImportJobRow, after?: unknown) {
    await deps.audit.record({
      actor,
      action,
      target: { kind: 'import_job', id: row.id },
      after: after ?? { source: row.source, site: row.site },
    });
  }

  return {
    async sources(actor: Actor): Promise<ImportSource[]> {
      await deps.authorize(actor, CAPABILITY, workspace);
      return catalog.list().map(describeSource);
    },

    async list(actor: Actor): Promise<ImportJob[]> {
      await deps.authorize(actor, CAPABILITY, workspace);
      return (await listJobs(sql, 50)).map(present);
    },

    async get(actor: Actor, id: string): Promise<ImportJob> {
      await deps.authorize(actor, CAPABILITY, workspace);
      return present(await jobById(sql, id));
    },

    async create(actor: Actor, body: CreateImportBody): Promise<ImportJob> {
      await deps.authorize(actor, CAPABILITY, workspace);
      const importer = importerFor(body.source);
      const connection = splitConnection(importer, body.values, deps.secrets);
      const site = importer.siteOf(connection.full);
      const discovery = await importer.discover(connection.full, {
        ...sourceContext(),
        mappings: createMappingStore(sql, { source: importer.id, site, jobId: null }),
      });
      const { containers, ...summary } = discovery;
      const row = await sql.begin(async (tx) => {
        const inserted = await insertJob(tx, {
          source: importer.id,
          site,
          connection: connection.shown,
          credentials: connection.sealed,
          discovery: { ...summary, total: containers.length },
          createdBy: userIdOf(actor),
        });
        await insertContainers(tx, inserted.id, containers);
        return inserted;
      });
      // A small site is counted now, so its first ticks can leave out the empty ones.
      if (containers.length < SMALL_SITE && importer.count) {
        const uncounted = await containerRefs(
          sql,
          row.id,
          containers.map((c) => c.id),
          true,
        );
        if (uncounted.length) {
          await saveCounts(
            sql,
            row.id,
            await importer.count(connection.full, uncounted, sourceContext()),
          );
        }
      }
      await preselect(sql, row.id, containers.length);
      await audit(actor, 'import.created', row);
      return present(row);
    },

    async update(actor: Actor, id: string, body: UpdateImportBody): Promise<ImportPlannedJob> {
      await deps.authorize(actor, CAPABILITY, workspace);
      const row = await jobById(sql, id);
      if (ACTIVE.has(row.status)) throw new ConflictError('The import is running');
      if (body.containers) {
        const unknown = await sql.begin((tx) => selectExactly(tx, id, body.containers ?? []));
        if (unknown.length) {
          throw new ValidationError(`${unknown.slice(0, 5).join(', ')} is not at the source`);
        }
      }
      const importer = importerFor(row.source);
      const plan = await buildPlan({
        sql,
        importer,
        connection: openConnection(row, deps.secrets),
        ctx: () => ({
          ...sourceContext(),
          mappings: createMappingStore(sql, { source: row.source, site: row.site, jobId: null }),
        }),
        row,
        body,
      });
      const [updated] = await sql<ImportJobRow[]>`
        update import_jobs set plan = ${JSON.stringify(plan)}::jsonb, updated_at = now()
        where id = ${id} returning *`;
      const attention = await listContainers(sql, id, { filter: 'attention', limit: 200 });
      return { ...present(updated ?? row), attention: attention.items };
    },

    /**
     * Queues a run. After a failure or a cancel it resumes from the checkpoint; after a
     * completed run it starts over, and the mappings make that an update, not a copy.
     */
    /**
     * Queues a run: from the start after a completed one, resuming after a failure or cancel,
     * or only the given containers again (Retry). See queueRun.
     */
    async run(actor: Actor, id: string, body: RunImportBody = {}): Promise<ImportJob> {
      await deps.authorize(actor, CAPABILITY, workspace);
      importerFor((await jobById(sql, id)).source);
      const updated = await queueRun(sql, deps.jobs, id, body);
      await audit(actor, 'import.started', updated, {
        runs: updated.runs,
        ...(body.containers ? { retried: body.containers.length } : {}),
      });
      return present(updated);
    },

    /** Every skipped record as CSV rows: container, kind, record, reason. */
    async skips(actor: Actor, id: string): Promise<string> {
      await deps.authorize(actor, CAPABILITY, workspace);
      await jobById(sql, id);
      return skipsCsv(sql, id);
    },

    async containers(actor: Actor, id: string, query: ImportContainerQuery) {
      await deps.authorize(actor, CAPABILITY, workspace);
      return chooser.containers(id, query);
    },

    async count(actor: Actor, id: string, body: ImportCountBody) {
      await deps.authorize(actor, CAPABILITY, workspace);
      return chooser.count(id, body);
    },

    async targets(actor: Actor, id: string, query: ImportTargetQuery) {
      await deps.authorize(actor, CAPABILITY, workspace);
      const lookup = importerFor((await jobById(sql, id)).source).targets;
      return { items: lookup ? await lookup.search(query.q ?? '', query.limit) : [] };
    },

    async people(actor: Actor, id: string, query: ImportPeopleQuery) {
      await deps.authorize(actor, CAPABILITY, workspace);
      await jobById(sql, id);
      return listPeople(sql, id, query);
    },

    async selection(actor: Actor, id: string) {
      await deps.authorize(actor, CAPABILITY, workspace);
      return chooser.selection(id);
    },

    async select(actor: Actor, id: string, body: ImportSelectionBody) {
      await deps.authorize(actor, CAPABILITY, workspace);
      return chooser.select(id, body);
    },

    async cancel(actor: Actor, id: string): Promise<ImportJob> {
      await deps.authorize(actor, CAPABILITY, workspace);
      const [row] = await sql<ImportJobRow[]>`
        update import_jobs set status = 'cancelled', updated_at = now()
        where id = ${id} and status in ('queued', 'running') returning *`;
      if (!row) {
        await jobById(sql, id);
        throw new ConflictError('Only a queued or running import can be cancelled');
      }
      await audit(actor, 'import.cancelled', row);
      return present(row);
    },
  };
}

export type ImportService = ReturnType<typeof createImportService>;
