import { createRetrievalService, type RetrievalService } from '@bemmoly/core';
import { createTestAi, type TestAi } from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PageDetail } from '../../../../shared/pages.ts';
import { startDocsHarness, type DocsHarness, type HarnessStart } from '../int-support.ts';
import { createPageSearchProvider } from '../palette/index.ts';
import { createPageRetrievalSource } from './index.ts';

const text = (value: string) => ({ type: 'text', text: value });
const heading = (value: string) => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [text(value)],
});
const paragraph = (value: string) => ({ type: 'paragraph', content: [text(value)] });

const RFC = {
  type: 'doc' as const,
  content: [
    paragraph('Sessions move from Redis to Postgres.'),
    heading('Rollback'),
    paragraph('If error rates exceed 0.5% after cutover, flip auth_pg_sessions off.'),
    heading('Rollback'),
    paragraph('Redis stays warm for 7 days.'),
  ],
};

describe('Docs pages as a retrieval source against Postgres', () => {
  let start: HarnessStart;
  let docs: DocsHarness;
  let ai: TestAi;
  let retrieval: RetrievalService;
  let rfc: PageDetail;
  let hidden: PageDetail;

  beforeAll(async () => {
    start = await startDocsHarness();
    if (!start.available) return;
    docs = start.harness;
    const space = await docs.space('RET');
    const secret = await docs.services.spaces.create(docs.as(docs.users.admin), {
      key: 'SEC',
      name: 'Secret',
    });
    rfc = await docs.services.pages.create(docs.as(docs.users.member), {
      spaceId: space.id,
      title: 'RFC: Move sessions to Postgres',
      snapshot: RFC,
    });
    hidden = await docs.services.pages.create(docs.as(docs.users.admin), {
      spaceId: secret.id,
      title: 'Rollback salary notes',
      snapshot: { type: 'doc', content: [paragraph('Rollback engineers earn band C.')] },
    });
    ai = createTestAi();
    const source = { ...createPageRetrievalSource(docs.sql), moduleId: 'docs' };
    const keyword = { ...createPageSearchProvider(docs.services.search), moduleId: 'docs' };
    retrieval = createRetrievalService({
      sql: docs.sql,
      ai: () => ai,
      sources: () => [source],
      keyword: () => [keyword],
      isEnabled: () => true,
    });
  });

  afterAll(async () => {
    if (start.available) await docs.stop();
  });

  it('splits a page at its headings with the anchors the read view prints', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const [page] = await createPageRetrievalSource(docs.sql).load([rfc.id]);
    expect(page?.path).toBe(`/docs/p/${rfc.id}`);
    expect(page?.chunks.map((chunk) => [chunk.location.label, chunk.location.anchor])).toEqual([
      ['RFC: Move sessions to Postgres', undefined],
      ['Rollback', 'rollback'],
      ['Rollback', 'rollback-2'],
    ]);
    expect(page?.chunks[1]?.authorId).toBe(docs.users.member);
  });

  it('keeps to the spaces a person is in, as the page list does', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const source = createPageRetrievalSource(docs.sql);
    const ids = [rfc.id, hidden.id];
    expect(await source.visible(docs.as(docs.users.member), ids)).toEqual(new Set([rfc.id]));
    expect(await source.visible(docs.as(docs.users.admin), ids)).toEqual(new Set(ids));
    expect(await source.visible(docs.as(docs.users.outsider), ids)).toEqual(new Set());
  });

  it('answers a member from their pages only, citing the heading', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    expect(await retrieval.indexRecords('docs.page', [rfc.id, hidden.id])).toMatchObject({
      status: 'indexed',
      indexed: 2,
    });
    const found = await retrieval.retrieve(docs.as(docs.users.member), {
      question: 'rollback flip auth_pg_sessions',
    });
    expect(found.sources.map((source) => source.targetId)).not.toContain(hidden.id);
    const rollback = found.sources.find((source) => source.location.label === 'Rollback');
    expect(rollback?.href).toMatch(new RegExp(`^/docs/p/${rfc.id}#rollback(-2)?$`));
    const outsider = await retrieval.retrieve(docs.as(docs.users.outsider), {
      question: 'rollback flip auth_pg_sessions',
    });
    expect(outsider.chunks).toEqual([]);
  });

  it('drops a page from the index once it is in the trash', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    await retrieval.indexRecords('docs.page', [hidden.id]);
    await docs.services.pages.remove(docs.as(docs.users.admin), hidden.id);
    await retrieval.indexRecords('docs.page', [hidden.id]);
    const [row] = await docs.sql<{ count: number }[]>`
      select count(*)::int as count from embeddings where target_id = ${hidden.id}`;
    expect(row?.count).toBe(0);
  });
});
