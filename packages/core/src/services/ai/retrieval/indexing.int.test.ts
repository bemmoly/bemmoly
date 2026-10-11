import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.ts';
import { RETRIEVAL_JOBS } from './index.ts';
import {
  createFixture,
  SPACE_OPEN,
  SPACE_SECRET,
  storedRows,
  type Fixture,
} from './retrieval-fixture.ts';

const P_ROLLBACK = '0199c0de-0000-7000-8000-00000000b001';
const P_SALARY = '0199c0de-0000-7000-8000-00000000b002';
const P_NOTES = '0199c0de-0000-7000-8000-00000000b003';

describe('retrieval indexing', () => {
  let database: TestDatabase;
  let f: Fixture | undefined;
  let skip: string | undefined;

  beforeAll(async () => {
    database = await startTestDatabase();
    if (!database.available) {
      skip = database.reason;
      return;
    }
    f = await createFixture(database.url);
  });

  afterAll(async () => {
    await f?.close();
    if (database?.available) await database.stop();
  });

  beforeEach(async () => {
    if (!f) return;
    await f.sql`delete from embeddings`;
    await f.sql`delete from pending_embeddings`;
    f.ai.setPolicy({
      enabled: true,
      shareContent: true,
      excludedSpaceIds: [],
      optedOutUserIds: [],
      availableRoles: ['fast', 'standard', 'strong', 'embedding'],
    });
    f.ai.embedded.length = 0;
    f.pages.clear();
    f.pages.set(P_ROLLBACK, {
      id: P_ROLLBACK,
      spaceId: SPACE_OPEN,
      title: 'RFC: Move sessions to Postgres',
      sections: [
        {
          heading: 'Context',
          text: 'Redis evictions logged people out.',
          authorId: f.users.writer,
        },
        {
          heading: 'Rollback',
          text: 'If error rates exceed 0.5% after cutover, flip auth_pg_sessions off.',
          authorId: f.users.writer,
        },
      ],
    });
    f.pages.set(P_SALARY, {
      id: P_SALARY,
      spaceId: SPACE_SECRET,
      title: 'Salary bands',
      sections: [{ heading: 'Bands', text: 'Level three earns band C.', authorId: f.users.writer }],
    });
    f.pages.set(P_NOTES, {
      id: P_NOTES,
      spaceId: SPACE_OPEN,
      title: 'Quiet notes',
      sections: [
        { heading: 'Notes', text: 'Private musings on cutovers.', authorId: f.users.quiet },
      ],
    });
  });

  it('stores chunks by heading with their space and location, and is idempotent', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    const first = await f.service.indexRecords('wiki.page', [P_ROLLBACK, P_SALARY]);
    expect(first).toMatchObject({ status: 'indexed', indexed: 2, embedded: 3 });
    const rows = await storedRows(f.sql);
    expect(rows.map((row) => [row.target_id, row.chunk_index, row.space_id])).toEqual([
      [P_ROLLBACK, 0, SPACE_OPEN],
      [P_ROLLBACK, 1, SPACE_OPEN],
      [P_SALARY, 0, SPACE_SECRET],
    ]);
    const [location] = await f.sql<{ location: unknown }[]>`
      select location from embeddings where target_id = ${P_ROLLBACK} and chunk_index = 1`;
    expect(location!.location).toEqual({ label: 'Rollback', anchor: 'rollback', part: 'body' });

    const again = await f.service.indexRecords('wiki.page', [P_ROLLBACK, P_SALARY]);
    expect(again).toMatchObject({ status: 'indexed', indexed: 2, embedded: 0 });
    expect(await storedRows(f.sql)).toEqual(rows);

    f.pages.get(P_ROLLBACK)!.sections[0]!.text = 'Redis evictions signed people out at peak.';
    const edited = await f.service.indexRecords('wiki.page', [P_ROLLBACK]);
    expect(edited).toMatchObject({ embedded: 1 });
  });

  it('drops a record that is gone', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    await f.service.indexRecords('wiki.page', [P_ROLLBACK]);
    f.pages.delete(P_ROLLBACK);
    await f.service.indexRecords('wiki.page', [P_ROLLBACK]);
    expect(await storedRows(f.sql)).toEqual([]);
  });

  it('never embeds excluded spaces or opted-out authors, and removes them when that changes', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    f.ai.setPolicy({ excludedSpaceIds: [SPACE_SECRET], optedOutUserIds: [f.users.quiet] });
    await f.service.indexRecords('wiki.page', [P_ROLLBACK, P_SALARY, P_NOTES]);
    const sent = f.ai.embedded.flat().join('\n');
    expect(sent).not.toContain('band C');
    expect(sent).not.toContain('Private musings');
    expect(new Set((await storedRows(f.sql)).map((row) => row.target_id))).toEqual(
      new Set([P_ROLLBACK]),
    );

    f.ai.setPolicy({ excludedSpaceIds: [], optedOutUserIds: [] });
    await f.service.indexRecords('wiki.page', [P_SALARY, P_NOTES]);
    expect((await storedRows(f.sql)).length).toBe(4);

    f.ai.setPolicy({ excludedSpaceIds: [SPACE_SECRET], optedOutUserIds: [f.users.quiet] });
    const swept = await f.service.reconcile();
    expect(swept).toMatchObject({ status: 'swept', removed: 2, backfill: false });
    expect(new Set((await storedRows(f.sql)).map((row) => row.target_id))).toEqual(
      new Set([P_ROLLBACK]),
    );
  });

  it('clears everything when content sharing is off and embeds nothing', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    await f.service.indexRecords('wiki.page', [P_ROLLBACK]);
    f.ai.setPolicy({ shareContent: false });
    expect(await f.service.reconcile()).toEqual({ status: 'cleared', removed: 2 });
    f.ai.embedded.length = 0;
    await f.service.indexRecords('wiki.page', [P_ROLLBACK]);
    expect(f.ai.embedded).toEqual([]);
    expect(await storedRows(f.sql)).toEqual([]);
  });

  it('does nothing while AI is off or no embedding model is set', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    f.ai.setPolicy({ enabled: false });
    expect(await f.service.indexRecords('wiki.page', [P_ROLLBACK])).toEqual({
      status: 'skipped',
      reason: 'ai_off',
    });
    f.ai.setPolicy({ enabled: true, availableRoles: ['standard'] });
    expect(await f.service.indexRecords('wiki.page', [P_ROLLBACK])).toEqual({
      status: 'skipped',
      reason: 'no_embedding_role',
    });
    expect(f.ai.embedded).toEqual([]);
  });

  it('turns change messages into one waiting drain and backfills on demand', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    f.jobs.queued.length = 0;
    const message = { kind: 'wiki.page', ids: [P_ROLLBACK], spaceId: SPACE_OPEN };
    await f.service.handleRealtime(message);
    await f.service.handleRealtime(message);
    await f.service.handleRealtime({ kind: 'wiki.comments', ids: [P_ROLLBACK] });
    expect(f.jobs.queued.map((job) => job.name)).toEqual([RETRIEVAL_JOBS.index]);
    expect(await f.jobs.runAll(RETRIEVAL_JOBS.index)).toBe(1);
    expect((await storedRows(f.sql)).length).toBe(2);

    await f.service.handleSettingsChanged({
      kind: 'ai.settings.changed',
      occurredAt: new Date(),
      payload: {},
    });
    await f.jobs.runAll(RETRIEVAL_JOBS.reconcile);
    for (let step = 0; step < 10 && f.jobs.queued.length > 0; step += 1) {
      await f.jobs.runAll(RETRIEVAL_JOBS.backfill);
    }
    expect(new Set((await storedRows(f.sql)).map((row) => row.target_id))).toEqual(
      new Set([P_ROLLBACK, P_SALARY, P_NOTES]),
    );
  });

  it('pauses a backfill while the budget is spent', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    f.ai.setPolicy({ budgetState: 'paused' });
    expect(await f.service.backfillStep({ source: 0, after: null })).toEqual({
      status: 'paused',
      reason: 'budget',
    });
    f.ai.setPolicy({ budgetState: 'unlimited' });
  });
});
