import { gzipSync } from 'node:zlib';
import type { LogChunkUpload } from '@bemmoly/module-pipelines/shared';
import { ValidationError } from '@bemmoly/shared';
import { isUnauthenticated } from '../clients/http.ts';
import type { Logger } from '../config/logger.ts';
import { cutLongLine } from '../utils/lines.ts';
import type { SecretMasker } from '../utils/mask.ts';
import { backoffMs, sleep } from '../utils/time.ts';
import type { JobOutbox } from './outbox.ts';

/** About 64 KB or 1 s of output per chunk, whichever comes first (architecture §6). */
export const CHUNK_BYTES = 64 * 1024;
export const CHUNK_MS = 1_000;
const MAX_LINES_PER_CHUNK = 10_000;
/** Above this many bytes of lines, a chunk travels gzip compressed. */
export const GZIP_ABOVE_BYTES = 32 * 1024;

export interface LogStreamOptions {
  send: (chunk: LogChunkUpload) => Promise<void>;
  outbox: JobOutbox;
  masker: SecretMasker;
  logger: Logger;
  /** The server no longer accepts this job's token: the job was taken away. */
  onLost?: (error: unknown) => void;
  chunkBytes?: number;
  chunkMs?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
}

interface Pending {
  chunk: LogChunkUpload;
  written: Promise<void>;
}

/**
 * A job's log: masks secrets, numbers lines from 1, batches them into ordered chunks (seq from
 * 0), and delivers them one at a time in order. A chunk that fails is resent with the same seq
 * until it lands, so a control-plane outage delays logs but never drops or reorders them.
 */
export class LogStream {
  private lines: string[] = [];
  private bytes = 0;
  private firstLine = 1;
  private stepPosition: number | undefined;
  private seq = 0;
  private lineNumber = 1;
  private timer: NodeJS.Timeout | undefined;
  private readonly queue: Pending[] = [];
  private pump: Promise<void> | undefined;
  private stopped = false;
  private readonly stop = new AbortController();

  private readonly options: LogStreamOptions;

  constructor(options: LogStreamOptions) {
    this.options = options;
  }

  /** The number the next line will get, which a step reports as its firstLine. */
  get nextLine(): number {
    return this.lineNumber;
  }

  line(text: string, stepPosition?: number): void {
    if (this.lines.length > 0 && stepPosition !== this.stepPosition) this.flush();
    if (this.lines.length === 0) {
      this.stepPosition = stepPosition;
      this.firstLine = this.lineNumber;
    }
    for (const piece of cutLongLine(this.options.masker.mask(text))) {
      this.lines.push(piece);
      this.bytes += Buffer.byteLength(piece) + 1;
      this.lineNumber++;
    }
    if (
      this.bytes >= (this.options.chunkBytes ?? CHUNK_BYTES) ||
      this.lines.length >= MAX_LINES_PER_CHUNK
    ) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.options.chunkMs ?? CHUNK_MS);
    }
  }

  /** Seals the lines so far into a chunk, writes it to the outbox and queues it. */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.lines.length === 0) return;
    const chunk = encodeChunk(this.seq++, this.firstLine, this.stepPosition, this.lines);
    this.lines = [];
    this.bytes = 0;
    this.queue.push({ chunk, written: this.options.outbox.put(chunk) });
    this.pump ??= this.deliver().finally(() => {
      this.pump = undefined;
    });
  }

  /**
   * Flushes and waits for every chunk to land, for at most `boundMs`. False means some chunks
   * are still in the outbox; they stay on disk for the next start to resend.
   */
  async close(boundMs: number): Promise<boolean> {
    this.flush();
    const drained = this.pump ?? Promise.resolve();
    let timer: NodeJS.Timeout | undefined;
    const bound = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), boundMs);
    });
    const outcome = await Promise.race([drained.then(() => 'drained' as const), bound]);
    clearTimeout(timer);
    this.stopped = true;
    this.stop.abort();
    return outcome === 'drained' && this.queue.length === 0;
  }

  private async deliver(): Promise<void> {
    let failures = 0;
    while (!this.stopped && this.queue.length > 0) {
      const next = this.queue[0]!;
      try {
        await next.written;
        await this.options.send(next.chunk);
        await this.options.outbox.remove(next.chunk.seq);
        this.queue.shift();
        failures = 0;
      } catch (error) {
        if (isUnauthenticated(error, 'job')) {
          this.stopped = true;
          this.options.onLost?.(error);
          return;
        }
        if (error instanceof ValidationError) {
          // The server refuses this chunk for good; resending it would block every later one.
          this.options.logger.error({ err: error, seq: next.chunk.seq }, 'log chunk refused');
          await this.options.outbox.remove(next.chunk.seq);
          this.queue.shift();
          continue;
        }
        const wait = backoffMs(
          failures++,
          this.options.retryBaseMs ?? 500,
          this.options.retryMaxMs ?? 15_000,
        );
        this.options.logger.warn(
          { err: (error as Error).message, seq: next.chunk.seq, wait },
          'log chunk not delivered; retrying',
        );
        await sleep(wait, this.stop.signal);
      }
    }
  }
}

export function encodeChunk(
  seq: number,
  firstLine: number,
  stepPosition: number | undefined,
  lines: string[],
): LogChunkUpload {
  const base = {
    seq,
    firstLine,
    lineCount: lines.length,
    ...(stepPosition === undefined ? {} : { stepPosition }),
  };
  const json = JSON.stringify(lines);
  if (Buffer.byteLength(json) <= GZIP_ABOVE_BYTES) return { ...base, lines };
  // The compressed form is the same JSON array of lines, gzipped, then base64.
  return { ...base, gzipBase64: gzipSync(json).toString('base64') };
}

/**
 * Resends what a previous run left in the outbox. A job whose token has expired or that the
 * server no longer recognises is dropped; anything else waits for the next start.
 */
export async function resendOutbox(
  pending: JobOutbox[],
  send: (job: { jobId: string; jobToken: string }, chunk: LogChunkUpload) => Promise<void>,
  logger: Logger,
): Promise<void> {
  for (const outbox of pending) {
    const { job } = outbox;
    if (Date.parse(job.expiresAt) < Date.now()) {
      logger.warn({ jobId: job.jobId }, 'dropping logs of an expired job');
      await outbox.discard();
      continue;
    }
    try {
      for (const chunk of await outbox.list()) {
        await send(job, chunk);
        await outbox.remove(chunk.seq);
      }
      await outbox.closeIfEmpty();
      logger.info({ jobId: job.jobId }, 'resent logs left from the last run');
    } catch (error) {
      if (isUnauthenticated(error, 'job') || error instanceof ValidationError) {
        await outbox.discard();
      } else {
        logger.warn({ jobId: job.jobId, err: (error as Error).message }, 'logs still waiting');
      }
    }
  }
}
