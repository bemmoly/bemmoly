import { describe, expect, it, vi } from 'vitest';
import type { JobQueue, QueuedJobHandler } from '../../../contracts/jobs.ts';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import { AI_CATALOG_REFRESH_JOB, registerCatalogRefresh } from './refresh.ts';
import type { CatalogResolver } from './resolver.ts';

/** Registers the job against a queue that only keeps the handler, and returns a runner. */
function setUp(aiEnabled: boolean) {
  let handler: QueuedJobHandler<unknown> | null = null;
  const jobs: JobQueue = {
    register: (name, run) => {
      if (name === AI_CATALOG_REFRESH_JOB) handler = run as QueuedJobHandler<unknown>;
    },
    enqueue: () => Promise.resolve(null),
  };
  const resolve = vi.fn(() => Promise.resolve({ data: {} }));
  const query = vi.fn(() => Promise.resolve([]));
  const sql = Object.assign(query, { unsafe: query }) as unknown as SqlExecutor;
  registerCatalogRefresh(jobs, {
    sql,
    catalog: { resolve } as unknown as CatalogResolver,
    aiEnabled: () => Promise.resolve(aiEnabled),
  });
  const run = () => handler!({}, { jobId: 'job', signal: new AbortController().signal });
  return { run, resolve };
}

describe('the daily catalog refresh', () => {
  it('asks for nothing while AI is off', async () => {
    const { run, resolve } = setUp(false);
    await run();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('refreshes the catalog while AI is on', async () => {
    const { run, resolve } = setUp(true);
    await run().catch(() => undefined);
    expect(resolve).toHaveBeenCalledWith({ force: true });
  });
});
