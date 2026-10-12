import type { Logger } from 'pino';
import { z } from 'zod';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Authorize } from '../../contracts/authz.ts';
import type { EventBus } from '../../contracts/event-bus.ts';
import type { ImportAddressPolicy } from '../../contracts/importer.ts';
import type { JobQueue } from '../../contracts/jobs.ts';
import type { ObjectStore } from '../../contracts/object-store.ts';
import type { FromModule } from '../../modules/registry.ts';
import type { ImporterDefinition } from '../../modules/registries.ts';
import { createAuditRecorder } from '../audit/index.ts';
import type { SecretBox } from '../settings/index.ts';
import { openConnection } from './connection.ts';
import { createImporterCatalog, type ImporterCatalog } from './define.ts';
import { createImportFetch } from '../../clients/import-fetch.ts';
import { createImportRunner, IMPORT_RUN_JOB } from './runner.ts';
import { createImportService, type ImportService } from './service.ts';

export interface ImportWiring {
  sql: SqlClient;
  modules: { importers(): FromModule<ImporterDefinition>[] };
  isEnabled?: (moduleId: string) => boolean;
  jobs: JobQueue;
  objectStore: ObjectStore;
  secrets: SecretBox;
  authorize: Authorize;
  /** BEMMOLY_ALLOW_PRIVATE_URLS: sources may then reach any address. */
  allowPrivateUrls: boolean;
  logger?: Pick<Logger, 'info' | 'warn' | 'error'>;
  /** Where a finished run's Inbox line goes. */
  events?: EventBus;
}

export interface Imports {
  service: ImportService;
  catalog: ImporterCatalog;
  /** Runs one import job now, as the queue would; for tests. */
  execute(importJobId: string, signal?: AbortSignal): Promise<void>;
}

const payloadSchema = z.object({ importJobId: z.uuid() });
/** A 10k-issue site takes minutes; the queue must not think a long run has died. */
const RUN_EXPIRY_SECONDS = 6 * 60 * 60;

/** Builds the import service and runner and registers the run job on the queue. */
export function wireImports(wiring: ImportWiring): Imports {
  const catalog = createImporterCatalog(() => wiring.modules.importers(), wiring.isEnabled);
  const fetchFor = (policy: ImportAddressPolicy) =>
    createImportFetch(wiring.allowPrivateUrls ? 'any' : policy);
  const service = createImportService({
    sql: wiring.sql,
    catalog,
    authorize: wiring.authorize,
    secrets: wiring.secrets,
    jobs: wiring.jobs,
    audit: createAuditRecorder(wiring.sql),
    fetchFor,
  });
  const runner = createImportRunner({
    sql: wiring.sql,
    catalog,
    objectStore: wiring.objectStore,
    fetchFor,
    connectionOf: (row) => openConnection(row, wiring.secrets),
    ...(wiring.logger ? { logger: wiring.logger } : {}),
    ...(wiring.events ? { events: wiring.events } : {}),
  });
  wiring.jobs.register(
    IMPORT_RUN_JOB,
    async (payload, ctx) => runner(payloadSchema.parse(payload).importJobId, ctx.signal),
    // The runner records failures itself; a re-delivery after a dead worker resumes the run.
    { retryLimit: 1, retryDelaySeconds: 30, expireInSeconds: RUN_EXPIRY_SECONDS },
  );
  return {
    service,
    catalog,
    execute: (id, signal) => runner(id, signal ?? new AbortController().signal),
  };
}
