import { createHash, randomUUID } from 'node:crypto';
import type { ImportReport } from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type {
  ImportRunContext,
  ImportRunTarget,
  ImportSourceContext,
} from '../../contracts/importer.ts';
import type { ObjectStore } from '../../contracts/object-store.ts';
import { safeFileName, sniffImage } from '../files/index.ts';
import { assertObjectKey } from '../storage/index.ts';
import { createMappingStore } from './mappings.ts';
import { createPeopleMatcher } from './people.ts';
import { emptyReport, type ImportJobRow } from './store.ts';

/** The report keeps this many skipped records with their reason; the total counts them all. */
export const REPORT_SKIP_LIMIT = 500;
const WARNING_LIMIT = 100;
/** Progress is written at most this often; a phase change or a checkpoint writes at once. */
const FLUSH_INTERVAL_MS = 750;

export class ImportCancelledError extends Error {
  override readonly name = 'ImportCancelledError';
}

export interface RunContextInput {
  sql: SqlClient;
  job: ImportJobRow;
  objectStore: ObjectStore;
  signal: AbortSignal;
  fetchFor: ImportSourceContext['fetchFor'];
  targets?: ReadonlyMap<string, ImportRunTarget>;
  /** The admin's choices for people: a member's id, or keep a placeholder. */
  people?: ReadonlyMap<string, string>;
}

/** What to bring when the plan predates the options: everything, as runs always did. */
const ALL = { comments: true, attachments: true, agile: true, links: true, history: false };

export interface RunContextHandle {
  ctx: ImportRunContext;
  report: ImportReport;
  /** Writes progress and the report now; throws ImportCancelledError when cancelled. */
  flush(): Promise<void>;
}

export function createRunContext(input: RunContextInput): RunContextHandle {
  const { sql, job } = input;
  const report: ImportReport = { ...emptyReport(), ...job.report };
  let checkpoint: unknown = job.checkpoint ?? null;
  let phase = job.phase;
  let done = job.progress_done;
  let total = job.progress_total;
  let lastFlush = 0;

  async function flush(): Promise<void> {
    lastFlush = Date.now();
    const [row] = await sql<{ status: string }[]>`
      update import_jobs set phase = ${phase}, progress_done = ${Math.min(done, total)},
        progress_total = ${total}, report = ${JSON.stringify(report)}::jsonb, updated_at = now()
      where id = ${job.id}
      returning status`;
    if (row?.status === 'cancelled') throw new ImportCancelledError('The import was cancelled');
  }

  const maybeFlush = async () => {
    if (Date.now() - lastFlush >= FLUSH_INTERVAL_MS) await flush();
  };

  const mappings = createMappingStore(sql, { source: job.source, site: job.site, jobId: job.id });
  const tally = (kind: string) => (report.counts[kind] ??= { created: 0, updated: 0, skipped: 0 });
  const reportApi: ImportRunContext['report'] = {
    count(kind, outcome, by = 1) {
      tally(kind)[outcome] += by;
    },
    skip(kind, source, reason) {
      // A skipped "issue" counts against "issues", the kind its created and updated go under.
      tally(kind.endsWith('s') ? kind : `${kind}s`).skipped += 1;
      report.skippedTotal += 1;
      if (report.skipped.length < REPORT_SKIP_LIMIT) report.skipped.push({ kind, source, reason });
    },
    warn(message) {
      if (report.warnings.length < WARNING_LIMIT && !report.warnings.includes(message)) {
        report.warnings.push(message);
      }
    },
  };

  const ctx: ImportRunContext = {
    jobId: job.id,
    actorUserId: job.created_by,
    include: job.plan?.include ?? ALL,
    targets: input.targets ?? new Map(),
    signal: input.signal,
    fetchFor: input.fetchFor,
    mappings,
    checkpoint: {
      read: <T>() => checkpoint as T | null,
      async save(value) {
        checkpoint = value;
        await sql`
          update import_jobs set checkpoint = ${JSON.stringify(value)}::jsonb, updated_at = now()
          where id = ${job.id}`;
        await flush();
      },
    },
    progress: {
      async phase(name, count) {
        phase = name;
        done = 0;
        total = Math.max(0, Math.floor(count));
        await flush();
      },
      async advance(by = 1) {
        done += by;
        if (done > total) total = done;
        await maybeFlush();
      },
    },
    report: reportApi,
    users: createPeopleMatcher(sql, mappings, reportApi, input.people),
    files: {
      async store({ bytes, contentType }) {
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        const storageKey = assertObjectKey(
          `attachments/imported/${sha256.slice(0, 2)}/${randomUUID()}`,
        );
        await input.objectStore.put(
          { key: storageKey, body: bytes, contentType, size: bytes.byteLength },
          { signal: input.signal },
        );
        return { storageKey, sha256, size: bytes.byteLength };
      },
      async storeImage({ bytes, name, target }) {
        const sniffed = sniffImage(bytes);
        if (sniffed.kind !== 'image') return null;
        const stored = await ctx.files.store({ bytes, contentType: sniffed.mime });
        const [row] = await sql<{ id: string }[]>`
          insert into files (target_kind, target_id, storage_key, filename, mime, size, sha256,
            uploaded_by)
          values (${target.kind}, ${target.id}, ${stored.storageKey},
            ${safeFileName(name, sniffed.mime)}, ${sniffed.mime}, ${stored.size},
            ${stored.sha256}, ${job.created_by}::uuid)
          returning id`;
        return row?.id ?? null;
      },
    },
  };
  return { ctx, report, flush };
}
