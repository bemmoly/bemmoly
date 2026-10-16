import { gunzipSync } from 'node:zlib';
import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import type {
  LogLine,
  LogRange,
  LogRangeQuery,
  LogSearch,
  LogSearchQuery,
} from '../../../../shared/logs.ts';
import type { LogChunkUpload } from '../../../../shared/runner.ts';
import { NOTIFY_PAYLOAD_LIMIT, topicOf } from '../../../../shared/streams.ts';
import { authorizePipelines, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import { publishStreamEvent } from '../streams/publish.ts';
import { isErrorLine, parseAnsi } from './ansi.ts';
import { createMasker } from './mask.ts';
import { chunkKey, createChunkStore, type LogObjects } from './store.ts';

export { createMasker } from './mask.ts';
export { isErrorLine, parseAnsi, stripAnsi } from './ansi.ts';

/*
 * Job logs (architecture §18): runners append ordered chunks; each is masked, stored as an
 * object and indexed by its first line, then announced on the job's stream topic with as
 * many lines as fit a NOTIFY. Reads take a line range through the index, so a 200,000-line
 * log costs one or two objects per screen; search scans the job's chunks on demand (logs
 * are not indexed).
 */

export interface LogsDeps extends PipelinesServiceDeps {
  objects?: LogObjects;
}

export interface LogJob {
  id: string;
  run_id: string;
  attempt: number;
  state: string;
}

const MAX_RANGE = 5000;
const MAX_SEARCH_LINES = 500_000;

interface ChunkRow {
  first_line: number;
  line_count: number;
  object_key: string;
  step_id: string | null;
}

function decode(chunk: LogChunkUpload): string[] {
  if (chunk.lines) return chunk.lines;
  const text = gunzipSync(Buffer.from(chunk.gzipBase64 ?? '', 'base64')).toString('utf8');
  return text === '' ? [] : text.split('\n');
}

function toLine(number: number, raw: string, stepId: string | null): LogLine {
  const { text, spans } = parseAnsi(raw);
  return { number, text, spans, error: isErrorLine(text, spans), stepId };
}

/** As many leading lines as keep the NOTIFY payload under Postgres' limit. */
function fitting(lines: LogLine[]): LogLine[] {
  const out: LogLine[] = [];
  let size = 400;
  for (const line of lines) {
    size += Buffer.byteLength(JSON.stringify(line)) + 1;
    if (size > NOTIFY_PAYLOAD_LIMIT - 200) break;
    out.push(line);
  }
  return out;
}

export function createLogsService(deps: LogsDeps) {
  const store = createChunkStore(deps.objects);

  async function chunksIn(sql: SqlExecutor, jobId: string, from: number, to: number) {
    return sql<ChunkRow[]>`
      select first_line, line_count, object_key, step_id from pipeline_log_chunks
      where job_id = ${jobId} and first_line <= ${to}
        and first_line + line_count - 1 >= ${from}
      order by first_line`;
  }

  async function linesIn(sql: SqlExecutor, jobId: string, from: number, to: number) {
    const lines: LogLine[] = [];
    for (const chunk of await chunksIn(sql, jobId, from, to)) {
      const raw = await store.read(chunk.object_key);
      raw.forEach((text, index) => {
        const number = chunk.first_line + index;
        if (number >= from && number <= to) lines.push(toLine(number, text, chunk.step_id));
      });
    }
    return lines;
  }

  async function jobFacts(sql: SqlExecutor, jobId: string) {
    const [facts] = await sql<
      { state: string; total: number; first_error: number | null; error_key: string | null }[]
    >`
      select j.state,
        coalesce((select max(first_line + line_count - 1) from pipeline_log_chunks
          where job_id = j.id), 0)::int as total,
        (select first_line from pipeline_log_chunks where job_id = j.id and has_error
          order by first_line limit 1) as first_error,
        (select object_key from pipeline_log_chunks where job_id = j.id and has_error
          order by first_line limit 1) as error_key
      from pipeline_jobs j where j.id = ${jobId}`;
    if (!facts) throw new NotFoundError('That job does not exist');
    return facts;
  }

  return {
    /** One chunk from a runner; a resent seq is acknowledged and stored once. */
    async append(
      sql: SqlExecutor,
      job: LogJob,
      chunk: LogChunkUpload,
      secrets: readonly string[] = [],
    ): Promise<{ stored: boolean }> {
      const mask = createMasker(secrets);
      const raw = decode(chunk);
      if (raw.length !== chunk.lineCount) {
        throw new ValidationError(
          `The chunk says ${chunk.lineCount} lines but carries ${raw.length}`,
        );
      }
      const lines = raw.map(mask);
      const [exists] = await sql`
        select 1 from pipeline_log_chunks where job_id = ${job.id} and seq = ${chunk.seq}`;
      if (exists) return { stored: false };
      const key = chunkKey(job.id, job.attempt, chunk.seq);
      const size = await store.write(key, lines);
      const [step] =
        chunk.stepPosition === undefined
          ? []
          : await sql<{ id: string }[]>`
              select id from pipeline_steps
              where job_id = ${job.id} and position = ${chunk.stepPosition}`;
      const stepId = step?.id ?? null;
      const parsed = lines.map((line, index) => toLine(chunk.firstLine + index, line, stepId));
      const inserted = await sql`
        insert into pipeline_log_chunks
          (job_id, step_id, seq, first_line, line_count, byte_size, object_key, has_error)
        values (${job.id}, ${stepId}::uuid, ${chunk.seq}, ${chunk.firstLine}, ${lines.length},
          ${size}, ${key}, ${parsed.some((line) => line.error)})
        on conflict (job_id, seq) do nothing
        returning id`;
      if (inserted.length === 0) return { stored: false };
      await publishStreamEvent(sql, {
        topic: topicOf.jobLog(job.id),
        kind: 'log.appended',
        data: {
          jobId: job.id,
          fromLine: chunk.firstLine,
          lines: fitting(parsed),
          toLine: chunk.firstLine + lines.length - 1,
        },
      });
      return { stored: true };
    },

    /** The first line that looks like an error, as written, for failure summaries. */
    async firstErrorText(sql: SqlExecutor, jobId: string): Promise<string | null> {
      const facts = await jobFacts(sql, jobId);
      if (!facts.error_key || facts.first_error === null) return null;
      const lines = await linesIn(sql, jobId, facts.first_error, facts.first_error + 10_000);
      return lines.find((line) => line.error)?.text ?? null;
    },

    async range(ctx: RequestContext, jobId: string, query: LogRangeQuery): Promise<LogRange> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const facts = await jobFacts(sql, jobId);
      let from = query.from ?? 1;
      let to = query.to ?? from + MAX_RANGE - 1;
      if (query.step) {
        const [step] = await sql<{ first: number | null; last: number | null }[]>`
          select min(first_line)::int as first, max(first_line + line_count - 1)::int as last
          from pipeline_log_chunks where job_id = ${jobId} and step_id = ${query.step}`;
        from = Math.max(from, step?.first ?? 1);
        to = Math.min(to, step?.last ?? 0);
      }
      if (query.tail) {
        to = facts.total;
        from = Math.max(1, to - query.tail + 1);
      }
      to = Math.min(to, from + MAX_RANGE - 1);
      const lines = to >= from ? await linesIn(sql, jobId, from, to) : [];
      let firstErrorLine: number | null = null;
      if (facts.first_error !== null) {
        const window = await linesIn(sql, jobId, facts.first_error, facts.first_error + 2000);
        firstErrorLine = window.find((line) => line.error)?.number ?? null;
      }
      return {
        jobId,
        lines: query.step ? lines.filter((line) => line.stepId === query.step) : lines,
        totalLines: facts.total,
        complete: !['pending', 'ready', 'claimed', 'running'].includes(facts.state),
        firstErrorLine,
      };
    },

    async search(ctx: RequestContext, jobId: string, query: LogSearchQuery): Promise<LogSearch> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const facts = await jobFacts(sql, jobId);
      const needle = query.q.toLowerCase();
      const matches: LogSearch['matches'] = [];
      const chunks = await chunksIn(sql, jobId, 1, Math.min(facts.total, MAX_SEARCH_LINES));
      for (const chunk of chunks) {
        if (query.step && chunk.step_id !== query.step) continue;
        const raw = await store.read(chunk.object_key);
        for (let index = 0; index < raw.length; index += 1) {
          const { text } = parseAnsi(raw[index] ?? '');
          const lower = text.toLowerCase();
          const ranges: Array<[number, number]> = [];
          for (
            let at = lower.indexOf(needle);
            at !== -1;
            at = lower.indexOf(needle, at + needle.length)
          ) {
            ranges.push([at, at + needle.length]);
          }
          if (ranges.length === 0) continue;
          if (matches.length >= query.limit) return { matches, truncated: true };
          matches.push({ line: chunk.first_line + index, text, ranges });
        }
      }
      return { matches, truncated: false };
    },
  };
}

export type LogsService = ReturnType<typeof createLogsService>;
