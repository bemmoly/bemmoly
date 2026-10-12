import { createMappingStore, type ImportRunContext } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConfluenceClient } from '../../clients/confluence.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';
import { writeTree } from './tree.ts';

/*
 * A Confluence import resumes from its mappings. If a run stops between creating a page and
 * mapping it, the resumed run cannot find that page and makes it again. Both are written in
 * one transaction, so a stop at that point leaves neither.
 */

const listed = [
  { id: 'c1', title: 'Handbook' },
  { id: 'c2', title: 'Onboarding', ancestors: [{ id: 'c1' }] },
  { id: 'c3', title: 'Runbooks' },
];
const client = {
  pages: async () => ({ results: listed, next: null }),
} as unknown as ConfluenceClient;

describe('Confluence page tree retries', () => {
  let harness: DocsHarness | null = null;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startDocsHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('a run that fails while mapping a page leaves no page its retry duplicates', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { sql, users } = harness;
    const space = await harness.space('CONF');
    const store = createMappingStore(sql, { source: 'confluence', site: 'wiki', jobId: null });
    let failOn: string | null = 'c2';
    const mappings = {
      ...store,
      set: async (...args: Parameters<typeof store.set>) => {
        if (args[1] === failOn) {
          failOn = null;
          throw new Error('connection lost while mapping');
        }
        await store.set(...args);
      },
    };
    const run = {
      mappings,
      actorUserId: users.member,
      progress: { phase: async () => undefined, advance: async () => undefined },
    } as unknown as ImportRunContext;
    const target = { sourceKey: 'HB', id: space.id };

    await expect(writeTree({ sql }, client, target, run)).rejects.toThrow('mapping');
    const tree = await writeTree({ sql }, client, target, run);

    const rows = await sql<{ title: string; n: number }[]>`
      select title, count(*)::int as n from pages
      where space_id = ${space.id} and deleted_at is null group by title order by title`;
    expect(rows).toEqual([
      { title: 'Handbook', n: 1 },
      { title: 'Onboarding', n: 1 },
      { title: 'Runbooks', n: 1 },
    ]);
    expect(tree.get('c1')?.created).toBe(false);
    expect(tree.get('c2')?.created).toBe(true);
  });
});
