import type { AiAnswerEvent } from '@bemmoly/shared/ai-answers';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.ts';
import { embeddingInput } from './chunks.ts';
import { createFixture, SPACE_OPEN, SPACE_SECRET, type Fixture } from './retrieval-fixture.ts';

const P_RFC = '0199c0de-0000-7000-8000-00000000c001';
const P_SALARY = '0199c0de-0000-7000-8000-00000000c002';
const P_RUNBOOK = '0199c0de-0000-7000-8000-00000000c003';

const ROLLBACK = 'If error rates exceed 0.5% after cutover, flip auth_pg_sessions off.';

async function collect(events: AsyncIterable<AiAnswerEvent>): Promise<AiAnswerEvent[]> {
  const all: AiAnswerEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

describe('retrieval and answers', () => {
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
    f.pages.set(P_RFC, {
      id: P_RFC,
      spaceId: SPACE_OPEN,
      title: 'RFC: Move sessions to Postgres',
      sections: [
        { heading: 'Context', text: 'Redis evictions logged people out.', authorId: null },
        { heading: 'Rollback', text: ROLLBACK, authorId: null },
      ],
    });
    f.pages.set(P_SALARY, {
      id: P_SALARY,
      spaceId: SPACE_SECRET,
      title: 'Salary bands for the rollback team',
      sections: [{ heading: 'Bands', text: 'Rollback engineers earn band C.', authorId: null }],
    });
    f.pages.set(P_RUNBOOK, {
      id: P_RUNBOOK,
      spaceId: SPACE_OPEN,
      title: 'Auth service runbook',
      sections: [
        { heading: 'Latency', text: 'Page on-call when login latency climbs.', authorId: null },
      ],
    });
    await f.service.indexRecords('wiki.page', [P_RFC, P_SALARY, P_RUNBOOK]);
  });

  afterAll(async () => {
    await f?.close();
    if (database?.available) await database.stop();
  });

  beforeEach(() => {
    if (!f) return;
    f.keywordOrder.override = null;
    f.ai.setPolicy({ enabled: true, availableRoles: ['fast', 'standard', 'strong', 'embedding'] });
  });

  it('never retrieves a chunk the asker cannot open, even when keywords find it', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    const question = 'rollback salary bands engineers';
    const reader = await f.service.retrieve(f.contextFor(f.users.reader), { question });
    expect(reader.sources.map((source) => source.targetId)).not.toContain(P_SALARY);
    expect(reader.chunks.map((chunk) => chunk.text).join(' ')).not.toContain('band C');
    const insider = await f.service.retrieve(f.contextFor(f.users.insider), { question });
    expect(insider.sources.map((source) => source.targetId)).toContain(P_SALARY);
    const stranger = await f.service.retrieve(f.contextFor(f.users.quiet), { question });
    expect(stranger.chunks).toEqual([]);
  });

  it('follows a permission change at once, with nothing re-indexed', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    const question = 'rollback salary bands engineers';
    const ask = async () =>
      (await f!.service.retrieve(f!.contextFor(f!.users.insider), { question })).sources.map(
        (source) => source.targetId,
      );
    expect(await ask()).toContain(P_SALARY);
    const before = f.readers.get(f.users.insider) ?? [];
    f.readers.set(f.users.insider, [SPACE_OPEN]);
    try {
      expect(await ask()).not.toContain(P_SALARY);
    } finally {
      f.readers.set(f.users.insider, before);
    }
    expect(await ask()).toContain(P_SALARY);
  });

  it('leaves out excluded spaces at query time, before any sweep', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    f.ai.setPolicy({ excludedSpaceIds: [SPACE_SECRET] });
    const insider = await f.service.retrieve(f.contextFor(f.users.insider), {
      question: 'rollback salary bands engineers',
    });
    expect(insider.sources.map((source) => source.targetId)).not.toContain(P_SALARY);
    f.ai.setPolicy({ excludedSpaceIds: [] });
  });

  it('ranks by reciprocal rank fusion: found by vectors and keywords beats keywords alone', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    const rfc = f.pages.get(P_RFC)!;
    // The exact embedded text: its vector is the question's, so the RFC leads the vector list.
    const question = embeddingInput(
      { id: rfc.id, title: rfc.title, path: '', containerId: SPACE_OPEN, chunks: [] },
      { text: ROLLBACK, authorId: null, location: { label: 'Rollback' } },
    );
    f.keywordOrder.override = [P_RUNBOOK, P_RFC];
    const found = await f.service.retrieve(f.contextFor(f.users.reader), { question });
    const order = [...new Set(found.sources.map((source) => source.targetId))];
    expect(order.slice(0, 2)).toEqual([P_RFC, P_RUNBOOK]);
    expect(found.sources[0]).toMatchObject({
      id: 'c1',
      href: `/wiki/${P_RFC}#rollback`,
      location: { label: 'Rollback' },
    });
    expect(found.chunks[0]!.text).toBe(ROLLBACK);
  });

  it('streams a cited answer with its sources first', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    f.keywordOrder.override = [P_RFC];
    f.ai.queue({ text: 'Flip auth_pg_sessions off when errors pass 0.5% [c1].' });
    const events = await collect(
      await f.service.answer(f.contextFor(f.users.reader), { question: 'How do we roll back?' }),
    );
    expect(events[0]!.type).toBe('sources');
    const sources = events[0]!.type === 'sources' ? events[0]!.sources : [];
    expect(sources.some((source) => source.targetId === P_RFC)).toBe(true);
    const streamed = events
      .filter((event) => event.type === 'delta')
      .map((event) => (event.type === 'delta' ? event.text : ''))
      .join('');
    expect(streamed).toBe('Flip auth_pg_sessions off when errors pass 0.5% [c1].');
    expect(events.at(-1)).toMatchObject({ type: 'done', outcome: 'answered', cited: ['c1'] });
    const prompt = JSON.stringify(f.ai.calls.at(-1)?.prompt);
    expect(prompt).toContain('[c1] RFC: Move sessions to Postgres (Rollback)');
    expect(f.ai.runs.at(-1)).toMatchObject({ purpose: 'qa', role: 'standard' });
  });

  it('says so honestly when the sources do not answer', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    f.keywordOrder.override = [P_RFC];
    f.ai.queue({ text: 'NO_ANSWER' });
    const events = await collect(
      await f.service.answer(f.contextFor(f.users.reader), { question: 'Who won the cup?' }),
    );
    expect(events.filter((event) => event.type === 'delta')).toEqual([]);
    expect(events.at(-1)).toMatchObject({ type: 'done', outcome: 'no_sources', text: '' });

    const calls = f.ai.calls.length;
    const empty = await collect(
      await f.service.answer(f.contextFor(f.users.quiet), { question: 'Who won the cup?' }),
    );
    expect(empty).toEqual([
      { type: 'sources', sources: [] },
      { type: 'done', outcome: 'no_sources', runId: null, text: '', cited: [] },
    ]);
    expect(f.ai.calls.length).toBe(calls);
  });

  it('refuses cleanly with AI off or without an embedding model', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    f.ai.setPolicy({ enabled: false });
    await expect(
      f.service.answer(f.contextFor(f.users.reader), { question: 'How do we roll back?' }),
    ).rejects.toMatchObject({ details: { reason: 'ai_off' } });
    f.ai.setPolicy({ enabled: true, availableRoles: ['standard'] });
    await expect(
      f.service.answer(f.contextFor(f.users.reader), { question: 'How do we roll back?' }),
    ).rejects.toMatchObject({ details: { reason: 'role_unset' } });
  });

  it('ends the stream with the provider failure in its own words', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    f.keywordOrder.override = [P_RFC];
    f.ai.queue({ error: new Error('upstream exploded') });
    const events = await collect(
      await f.service.answer(f.contextFor(f.users.reader), { question: 'How do we roll back?' }),
    );
    expect(events.at(-1)).toMatchObject({ type: 'error' });
  });
});
