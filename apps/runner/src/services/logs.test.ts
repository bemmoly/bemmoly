import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { LogChunkUpload } from '@bemmoly/module-pipelines/shared';
import { ProviderError, UnauthenticatedError } from '@bemmoly/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../config/logger.ts';
import { SecretMasker } from '../utils/mask.ts';
import { GZIP_ABOVE_BYTES, LogStream, encodeChunk, resendOutbox } from './logs.ts';
import { Outbox, type JobOutbox } from './outbox.ts';

const logger = createLogger('silent');
const JOB = {
  jobId: 'job-1',
  jobToken: 'tok',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

let dir: string;
let outbox: JobOutbox;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'bemmoly-logs-'));
  outbox = await new Outbox(dir).open(JOB);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function stream(send: (chunk: LogChunkUpload) => Promise<void>, extra = {}) {
  const masker = new SecretMasker();
  masker.add(['hunter2-secret']);
  return new LogStream({ send, outbox, masker, logger, retryBaseMs: 5, retryMaxMs: 10, ...extra });
}

describe('log chunking', () => {
  it('numbers chunks from 0 and lines from 1, and starts a chunk when the step changes', async () => {
    const sent: LogChunkUpload[] = [];
    const logs = stream(async (chunk) => void sent.push(chunk));
    logs.line('checking out');
    expect(logs.nextLine).toBe(2);
    logs.line('a', 0);
    logs.line('b', 0);
    logs.line('c', 1);
    expect(await logs.close(1_000)).toBe(true);
    expect(sent).toEqual([
      { seq: 0, firstLine: 1, lineCount: 1, lines: ['checking out'] },
      { seq: 1, firstLine: 2, lineCount: 2, stepPosition: 0, lines: ['a', 'b'] },
      { seq: 2, firstLine: 4, lineCount: 1, stepPosition: 1, lines: ['c'] },
    ]);
  });

  it('seals a chunk at the size limit and after the time limit', async () => {
    const sent: LogChunkUpload[] = [];
    const logs = stream(async (chunk) => void sent.push(chunk), { chunkBytes: 20, chunkMs: 30 });
    logs.line('0123456789');
    logs.line('0123456789');
    expect(sent).toHaveLength(0);
    // Sealed chunks go out through the disk outbox; wait for them rather than a fixed beat.
    await vi.waitFor(() => expect(sent.map((c) => c.lineCount)).toEqual([2]), { timeout: 2_000 });
    logs.line('slow');
    await vi.waitFor(
      () => expect(sent.map((c) => c.lines)).toEqual([['0123456789', '0123456789'], ['slow']]),
      { timeout: 2_000 },
    );
    await logs.close(1_000);
  });

  it('masks secrets before anything leaves the runner or reaches the disk', async () => {
    const sent: LogChunkUpload[] = [];
    const logs = stream(async (chunk) => void sent.push(chunk));
    logs.line('token is hunter2-secret');
    await logs.close(1_000);
    expect(sent[0]!.lines).toEqual(['token is ***']);
  });

  it('gzips a large chunk as the same JSON array of lines', () => {
    const lines = Array.from({ length: 2_000 }, (_, i) => `line number ${i} with padding`);
    const chunk = encodeChunk(4, 10, 2, lines);
    expect(JSON.stringify(lines).length).toBeGreaterThan(GZIP_ABOVE_BYTES);
    expect(chunk.lines).toBeUndefined();
    expect(JSON.parse(gunzipSync(Buffer.from(chunk.gzipBase64!, 'base64')).toString())).toEqual(
      lines,
    );
    expect(chunk).toMatchObject({ seq: 4, firstLine: 10, stepPosition: 2, lineCount: 2_000 });
  });
});

describe('the outbox', () => {
  it('writes each chunk before sending and resends it with the same seq until it lands', async () => {
    const attempts: number[] = [];
    let failures = 3;
    const logs = stream(async (chunk) => {
      expect(existsSync(path.join(outbox.dir, `${chunk.seq}.json`))).toBe(true);
      attempts.push(chunk.seq);
      if (failures-- > 0) throw new ProviderError('down');
    });
    logs.line('one');
    logs.flush();
    logs.line('two');
    expect(await logs.close(2_000)).toBe(true);
    expect(attempts).toEqual([0, 0, 0, 0, 1]);
    expect((await readdir(outbox.dir)).filter((f) => f !== 'job.json')).toEqual([]);
  });

  it('leaves undelivered chunks on disk when the bound runs out, for the next start', async () => {
    const logs = stream(async () => {
      throw new ProviderError('down');
    });
    logs.line('kept');
    expect(await logs.close(50)).toBe(false);
    const pending = await new Outbox(dir).pending();
    expect(pending.map((p) => p.job.jobId)).toEqual(['job-1']);

    const resent: [string, number][] = [];
    await resendOutbox(
      pending,
      async (job, chunk) => void resent.push([job.jobToken, chunk.seq]),
      logger,
    );
    expect(resent).toEqual([['tok', 0]]);
    expect(await new Outbox(dir).pending()).toEqual([]);
  });

  it('stops and reports the job lost when the server rejects the job token', async () => {
    let lost = false;
    const logs = stream(
      async () => {
        throw new UnauthenticatedError('gone', { details: { scope: 'job' } });
      },
      { onLost: () => (lost = true) },
    );
    logs.line('x');
    await logs.close(500);
    expect(lost).toBe(true);
  });
});
