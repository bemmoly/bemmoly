import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { logChunkUploadSchema, type LogChunkUpload } from '@bemmoly/module-pipelines/shared';
import { z } from 'zod';

const JOB_FILE = 'job.json';

const outboxJobSchema = z.object({
  jobId: z.string().min(1),
  jobToken: z.string().min(1),
  expiresAt: z.string(),
});

/** What a later start needs to resend a job's chunks: the job and the token it was given. */
export type OutboxJob = z.infer<typeof outboxJobSchema>;

/**
 * Log chunks on disk, one file per chunk under <data-dir>/outbox/<jobId>/<seq>.json. A chunk
 * is written before it is sent and deleted after the server took it, so an outage or a crash
 * loses nothing: the next send, or the next start, resends it with the same seq.
 */
export class Outbox {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async open(job: OutboxJob): Promise<JobOutbox> {
    const dir = path.join(this.root, safeSegment(job.jobId));
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writePrivate(path.join(dir, JOB_FILE), JSON.stringify(job));
    return new JobOutbox(dir, job);
  }

  /** Jobs whose chunks a previous run could not deliver. */
  async pending(): Promise<JobOutbox[]> {
    const entries = await readdir(this.root, { withFileTypes: true }).catch(() => []);
    const found: JobOutbox[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(this.root, entry.name);
      const raw = await readFile(path.join(dir, JOB_FILE), 'utf8').catch(() => undefined);
      const parsed = raw === undefined ? undefined : outboxJobSchema.safeParse(safeJson(raw));
      if (parsed?.success) found.push(new JobOutbox(dir, parsed.data));
      else await rm(dir, { recursive: true, force: true });
    }
    return found;
  }
}

export class JobOutbox {
  readonly dir: string;
  readonly job: OutboxJob;

  constructor(dir: string, job: OutboxJob) {
    this.dir = dir;
    this.job = job;
  }

  async put(chunk: LogChunkUpload): Promise<void> {
    await writePrivate(this.file(chunk.seq), JSON.stringify(chunk));
  }

  async remove(seq: number): Promise<void> {
    await rm(this.file(seq), { force: true });
  }

  /** Waiting chunks in seq order; a file that does not parse (a torn write) is dropped. */
  async list(): Promise<LogChunkUpload[]> {
    const names = await readdir(this.dir).catch(() => []);
    const chunks: LogChunkUpload[] = [];
    for (const name of names) {
      if (!/^\d+\.json$/.test(name)) continue;
      const raw = await readFile(path.join(this.dir, name), 'utf8').catch(() => undefined);
      const parsed = raw === undefined ? undefined : logChunkUploadSchema.safeParse(safeJson(raw));
      if (parsed?.success) chunks.push(parsed.data);
      else await rm(path.join(this.dir, name), { force: true });
    }
    return chunks.sort((a, b) => a.seq - b.seq);
  }

  /** Removes the job's folder once nothing is waiting in it. */
  async closeIfEmpty(): Promise<boolean> {
    if ((await this.list()).length > 0) return false;
    await this.discard();
    return true;
  }

  async discard(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true });
  }

  private file(seq: number): string {
    return path.join(this.dir, `${seq}.json`);
  }
}

/** Write then rename, so a crash leaves the old file or the new one, never half of one. */
async function writePrivate(file: string, content: string): Promise<void> {
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, content, { mode: 0o600 });
  await rename(temp, file);
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_');
}
