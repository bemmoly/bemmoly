import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.ts';
import { embeddingInput } from './chunks.ts';
import { createFixture, SPACE_OPEN, type Fixture } from './retrieval-fixture.ts';

const PAGE = '0199c0de-0000-7000-8000-00000000d001';

describe('retrieval at an indexed vector size', () => {
  let database: TestDatabase;
  let f: Fixture | undefined;
  let skip: string | undefined;

  beforeAll(async () => {
    database = await startTestDatabase();
    if (!database.available) {
      skip = database.reason;
      return;
    }
    f = await createFixture(database.url, 384);
  });

  afterAll(async () => {
    await f?.close();
    if (database?.available) await database.stop();
  });

  it('finds the exact chunk first through the 384-dimension cast', async (ctx) => {
    if (!f) return ctx.skip(skip ?? 'no database');
    const section = { heading: 'Rollback', text: 'Flip auth_pg_sessions off.', authorId: null };
    f.pages.set(PAGE, { id: PAGE, spaceId: SPACE_OPEN, title: 'RFC', sections: [section] });
    await f.service.indexRecords('wiki.page', [PAGE]);
    const [row] = await f.sql<{ dimensions: number }[]>`select dimensions from embeddings`;
    expect(row?.dimensions).toBe(384);
    const question = embeddingInput(
      { id: PAGE, title: 'RFC', path: '', containerId: SPACE_OPEN, chunks: [] },
      { text: section.text, authorId: null, location: { label: 'Rollback' } },
    );
    f.keywordOrder.override = [];
    const found = await f.service.retrieve(f.contextFor(f.users.reader), { question });
    expect(found.chunks[0]?.text).toBe('Flip auth_pg_sessions off.');
  });
});
