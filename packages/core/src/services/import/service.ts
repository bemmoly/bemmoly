import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type CreateImportBody,
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
import { openConnection, splitConnection } from './connection.ts';
import { describeSource, type ImporterCatalog } from './define.ts';
import { createMappingStore } from './mappings.ts';
import { IMPORT_RUN_JOB } from './runner.ts';
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
      const discovery = await importer.discover(connection.full, sourceContext());
      const row = await insertJob(sql, {
        source: importer.id,
        site: importer.siteOf(connection.full),
        connection: connection.shown,
        credentials: connection.sealed,
        discovery,
        createdBy: userIdOf(actor),
      });
      await audit(actor, 'import.created', row);
      return present(row);
    },

    async update(actor: Actor, id: string, body: UpdateImportBody): Promise<ImportJob> {
      await deps.authorize(actor, CAPABILITY, workspace);
      const row = await jobById(sql, id);
      if (ACTIVE.has(row.status)) throw new ConflictError('The import is running');
      const known = new Set(row.discovery?.containers.map((container) => container.id) ?? []);
      const unknown = body.containers.filter((container) => !known.has(container));
      if (unknown.length) throw new ValidationError(`${unknown.join(', ')} is not at the source`);
      const importer = importerFor(row.source);
      const plan = await importer.plan(openConnection(row, deps.secrets), body.containers, {
        ...sourceContext(),
        mappings: createMappingStore(sql, { source: row.source, site: row.site, jobId: null }),
      });
      const [updated] = await sql<ImportJobRow[]>`
        update import_jobs set plan = ${JSON.stringify(plan)}::jsonb, updated_at = now()
        where id = ${id} returning *`;
      return present(updated ?? row);
    },

    /**
     * Queues a run. After a failure or a cancel it resumes from the checkpoint; after a
     * completed run it starts over, and the mappings make that an update, not a copy.
     */
    async run(actor: Actor, id: string): Promise<ImportJob> {
      await deps.authorize(actor, CAPABILITY, workspace);
      importerFor((await jobById(sql, id)).source);
      const updated = await sql.begin(async (tx) => {
        const row = await jobById(tx, id);
        if (ACTIVE.has(row.status)) throw new ConflictError('The import is already running');
        if (!row.plan) throw new ValidationError('Pick what to bring in before running');
        const fresh = row.status === 'ready' || row.status === 'completed';
        const [queued] = await tx<ImportJobRow[]>`
          update import_jobs set status = 'queued', error = null, finished_at = null,
            runs = runs + ${fresh ? 1 : 0},
            checkpoint = ${fresh ? null : tx`checkpoint`},
            report = ${fresh ? tx`'{}'::jsonb` : tx`report`},
            started_at = ${fresh ? null : tx`started_at`},
            progress_done = ${fresh ? 0 : tx`progress_done`}, updated_at = now()
          where id = ${id} returning *`;
        if (!queued) throw new NotFoundError('The import was not found');
        await deps.jobs.enqueue(
          IMPORT_RUN_JOB,
          { importJobId: id },
          { key: `${IMPORT_RUN_JOB}:${id}:${queued.runs}:${Date.now()}`, transaction: tx },
        );
        return queued;
      });
      await audit(actor, 'import.started', updated, { runs: updated.runs });
      return present(updated);
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
