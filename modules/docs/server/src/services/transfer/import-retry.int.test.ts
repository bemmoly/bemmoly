import { createNotifyPublisher, REALTIME_CHANNEL, type SqlClient } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importJob } from '../../config/jobs.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

/*
 * Large imports run as a job that pg-boss retries when it throws. These tests drive the job
 * handler the way the queue does, with the real NOTIFY publisher behind the captured one, and
 * check that an import of any size writes its pages exactly once, whatever fails after commit.
 */

const queued: { name: string; payload: unknown }[] = [];
const jobs = {
  send: async (name: string, payload?: unknown) => {
    queued.push({ name, payload });
    return `job-${queued.length}`;
  },
};

/** When set, the next publish throws, as a post-commit failure would. */
let failNextPublish = false;
const realtime = (sql: SqlClient) => {
  const real = createNotifyPublisher(sql);
  return {
    publish: async (...args: Parameters<typeof real.publish>) => {
      if (failNextPublish) {
        failNextPublish = false;
        throw new Error('forced failure after commit');
      }
      await real.publish(...args);
    },
  };
};

const notes = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ path: `notes/n${i}.md`, content: `# Note ${i}` }));

describe('import job retries', () => {
  let harness: DocsHarness | null = null;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startDocsHarness({ jobs, realtime });
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  async function queue(spaceKey: string, count: number, uploadKey: string) {
    const { services, as, users } = harness!;
    const space = await harness!.space(spaceKey);
    const result = await services.transfer.importPages(
      as(users.member),
      spaceKey,
      { format: 'markdown', files: notes(count) },
      uploadKey,
    );
    expect(result.status).toBe('queued');
    const job = queued.at(-1)!;
    const run = (jobId: string) =>
      importJob(services.transfer).handle(job.payload, {
        jobId,
        signal: new AbortController().signal,
      });
    return { space, run };
  }

  async function pages(spaceId: string) {
    return harness!.sql<{ title: string; n: number }[]>`
      select title, count(*)::int as n from pages
      where space_id = ${spaceId} and deleted_at is null group by title`;
  }

  it('imports 450 pages in one run, notifies every id, and a rerun adds nothing', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const received: string[] = [];
    const listener = await harness.sql.listen(REALTIME_CHANNEL, (payload) => {
      received.push(...(JSON.parse(payload) as { ids: string[] }).ids);
    });
    try {
      const { space, run } = await queue('HUGE', 450, 'upload-450');
      await expect(run('job-a')).resolves.toBeUndefined();
      const rows = await pages(space.id);
      expect(rows).toHaveLength(451);
      expect(rows.every((row) => row.n === 1)).toBe(true);
      const ids = await harness.sql<{ id: string }[]>`
        select id from pages where space_id = ${space.id}`;
      const notified = () => ids.filter((row) => received.includes(row.id)).length;
      await expect.poll(notified, { timeout: 5000 }).toBe(451);

      await expect(run('job-a')).resolves.toBeUndefined();
      expect(await pages(space.id)).toHaveLength(451);
    } finally {
      await listener.unlisten();
    }
  });

  it('a failure after commit and the retry that follows import the pages once', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { space, run } = await queue('RETRY', 60, 'upload-60');
    failNextPublish = true;
    await expect(run('job-b')).rejects.toThrow('forced failure after commit');
    expect(await pages(space.id)).toHaveLength(61);

    await expect(run('job-b')).resolves.toBeUndefined();
    await expect(run('job-b')).resolves.toBeUndefined();
    const rows = await pages(space.id);
    expect(rows).toHaveLength(61);
    expect(rows.every((row) => row.n === 1)).toBe(true);
  });

  it('a job queued without a key still imports once across retries of the same job', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { space } = await queue('LEGACY', 30, 'upload-legacy');
    const payload = { ...(queued.at(-1)!.payload as Record<string, unknown>) };
    delete payload.key;
    const handle = (jobId: string) =>
      importJob(harness!.services.transfer).handle(payload, {
        jobId,
        signal: new AbortController().signal,
      });
    failNextPublish = true;
    await expect(handle('job-c')).rejects.toThrow();
    await handle('job-c');
    expect(await pages(space.id)).toHaveLength(31);
  });
});
