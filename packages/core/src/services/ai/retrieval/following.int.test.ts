import { pino } from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SqlClient } from '../../../clients/postgres.ts';
import { loadModules } from '../../../modules/loader.ts';
import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.ts';
import { createJobsService, type JobsService } from '../../jobs/index.ts';
import { createRetrievalService, RETRIEVAL_JOBS, type RetrievalService } from './index.ts';
import { DRAIN_PAGE } from './follow.ts';
import { markPending, peekPending, settlePending } from './pending.ts';
import {
  createFixture,
  SPACE_OPEN,
  SPACE_SECRET,
  storedRows,
  type Fixture,
} from './retrieval-fixture.ts';

const NO_EMBEDDING = ['fast', 'standard', 'strong'] as const;
const ALL_ROLES = ['fast', 'standard', 'strong', 'embedding'] as const;
const pageId = (n: number) => `0199c0de-0000-7000-8000-${String(n).padStart(12, '0')}`;

/*
 * How index work is queued, on a real pg-boss queue over real Postgres: nothing while
 * retrieval cannot run, one waiting drain per source however large the burst, and a backfill
 * that catches up once it can.
 */
describe('retrieval change following', () => {
  let database: TestDatabase;
  let f: Fixture | undefined;
  let queue: JobsService | undefined;
  let live: RetrievalService | undefined;
  let skip: string | undefined;

  beforeAll(async () => {
    database = await startTestDatabase();
    if (!database.available) {
      skip = database.reason;
      return;
    }
    f = await createFixture(database.url);
    queue = createJobsService({
      sql: f.sql,
      databaseUrl: f.url,
      role: 'api',
      logger: pino({ level: 'silent' }),
      modules: loadModules({ available: [] }),
    });
    live = createRetrievalService({ ...f.deps, jobs: queue });
    for (const job of live.jobs()) queue.register(job.name, (payload) => job.handle(payload));
    await queue.start([]);
  });

  afterAll(async () => {
    await queue?.stop();
    await f?.close();
    if (database?.available) await database.stop();
  });

  beforeEach(async () => {
    if (!f) return;
    await f.sql`delete from embeddings`;
    await f.sql`delete from pending_embeddings`;
    await f.sql`delete from pgboss.job where name = ${RETRIEVAL_JOBS.index}`;
    f.jobs.queued.length = 0;
    f.ai.embedded.length = 0;
    f.ai.setPolicy({
      enabled: true,
      shareContent: true,
      excludedSpaceIds: [],
      availableRoles: [...ALL_ROLES],
    });
    f.pages.clear();
    for (let n = 1; n <= 120; n += 1) {
      f.pages.set(pageId(n), {
        id: pageId(n),
        spaceId: n % 2 ? SPACE_OPEN : SPACE_SECRET,
        title: `Page ${n}`,
        sections: [{ heading: 'Body', text: `Notes number ${n}.`, authorId: null }],
      });
    }
  });

  const waiting = async (sql: SqlClient) => {
    const [row] = await sql<{ count: number }[]>`
      select count(*)::int as count from pgboss.job
      where name = ${RETRIEVAL_JOBS.index} and state in ('created', 'retry')`;
    return row!.count;
  };
  const pendingCount = async (sql: SqlClient) => {
    const [row] = await sql<{ count: number }[]>`
      select count(*)::int as count from pending_embeddings`;
    return row!.count;
  };
  const burst = async (service: RetrievalService) => {
    for (let n = 1; n <= 120; n += 1) {
      const spaceId = n % 2 ? SPACE_OPEN : SPACE_SECRET;
      await service.handleRealtime({ kind: 'wiki.page', ids: [pageId(n)], spaceId });
      await service.handleRealtime({ kind: 'wiki.page', ids: [pageId(n)], spaceId });
    }
  };

  it('queues nothing while there is no embedding role, AI is off or sharing is off', async (ctx) => {
    if (!f || !live) return ctx.skip(skip ?? 'no database');
    for (const block of [
      { availableRoles: [...NO_EMBEDDING] },
      { enabled: false },
      { shareContent: false },
    ]) {
      f.ai.setPolicy({ enabled: true, shareContent: true, availableRoles: [...ALL_ROLES] });
      f.ai.setPolicy(block);
      await burst(live);
      expect(await waiting(f.sql)).toBe(0);
      expect(await pendingCount(f.sql)).toBe(0);
    }
  });

  it('drains what a blocked install queued before, without touching the database', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    const untouchable = new Proxy(() => undefined, {
      apply: () => {
        throw new Error('the database was read');
      },
      get: () => {
        throw new Error('the database was read');
      },
    }) as unknown as SqlClient;
    const blocked = createRetrievalService({ ...f.deps, sql: untouchable });
    const index = blocked.jobs().find((job) => job.name === RETRIEVAL_JOBS.index)!;
    f.ai.setPolicy({ availableRoles: [...NO_EMBEDDING] });
    await expect(index.handle({ kind: 'wiki.page', ids: [pageId(1)] })).resolves.toBeUndefined();
    await expect(index.handle({ kind: 'wiki.page' })).resolves.toBeUndefined();
    f.ai.setPolicy({ availableRoles: [...ALL_ROLES], shareContent: false });
    await expect(index.handle({ kind: 'wiki.page', ids: [pageId(1)] })).resolves.toBeUndefined();
    expect(f.ai.embedded).toEqual([]);
  });

  it('backfills everything once AI is on with an embedding role', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    f.ai.setPolicy({ enabled: false, availableRoles: [...NO_EMBEDDING] });
    await burst(f.service);
    expect(f.jobs.queued).toEqual([]);

    f.ai.setPolicy({ enabled: true, availableRoles: [...ALL_ROLES] });
    await f.service.handleSettingsChanged({
      kind: 'ai.settings.changed',
      occurredAt: new Date(),
      payload: { reasons: ['enabled', 'embedding_role'] },
    });
    expect(await f.jobs.runAll(RETRIEVAL_JOBS.reconcile)).toBe(1);
    for (let step = 0; step < 20 && f.jobs.queued.length > 0; step += 1) {
      await f.jobs.runAll(RETRIEVAL_JOBS.backfill);
    }
    const indexed = new Set((await storedRows(f.sql)).map((row) => row.target_id));
    expect(indexed).toEqual(new Set(f.pages.keys()));
  });

  it('keeps one waiting job for many changes, to one record or to many', async (ctx) => {
    if (!f || !live) return ctx.skip(skip ?? 'no database');
    for (let n = 0; n < 100; n += 1) {
      await live.handleRealtime({ kind: 'wiki.page', ids: [pageId(1)], spaceId: SPACE_OPEN });
    }
    expect(await waiting(f.sql)).toBe(1);
    expect(await pendingCount(f.sql)).toBe(1);

    await burst(live);
    expect(await waiting(f.sql)).toBe(1);
    expect(await pendingCount(f.sql)).toBe(120);
  });

  it('drains the pending records page by page and indexes each once', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    await burst(f.service);
    expect(f.jobs.queued).toHaveLength(1);
    expect(await f.jobs.runAll(RETRIEVAL_JOBS.index)).toBe(1);
    expect(await pendingCount(f.sql)).toBe(120 - DRAIN_PAGE);
    expect(f.jobs.queued).toHaveLength(1);
    expect(await f.jobs.runAll(RETRIEVAL_JOBS.index)).toBe(1);
    expect(await pendingCount(f.sql)).toBe(0);
    expect(f.jobs.queued).toEqual([]);
    expect(new Set((await storedRows(f.sql)).map((row) => row.target_id)).size).toBe(120);
    expect(f.ai.embedded.flat()).toHaveLength(120);
  });

  it('drops chunks of records that change inside an excluded space, and queues nothing', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    await f.service.indexRecords('wiki.page', [pageId(2)]);
    f.ai.setPolicy({ excludedSpaceIds: [SPACE_SECRET] });
    await f.service.handleRealtime({ kind: 'wiki.page', ids: [pageId(2)], spaceId: SPACE_SECRET });
    expect(f.jobs.queued).toEqual([]);
    expect(await storedRows(f.sql)).toEqual([]);
  });

  it('keeps a record that changed again while it was being indexed', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    await markPending(f.sql, 'wiki.page', [pageId(1), pageId(2)]);
    const seen = await peekPending(f.sql, 'wiki.page', 10);
    await markPending(f.sql, 'wiki.page', [pageId(2)]);
    await settlePending(f.sql, 'wiki.page', seen);
    expect((await peekPending(f.sql, 'wiki.page', 10)).map((mark) => mark.targetId)).toEqual([
      pageId(2),
    ]);
  });
});
