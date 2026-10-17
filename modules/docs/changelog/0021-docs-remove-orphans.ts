import { changeset, deleteInBatches, sql, textAsUuid } from '@bemmoly/core/changelog';

/*
 * Removes links and kernel rows that point at pages deleted before 0019, and links to
 * issues that are gone when Work is installed. Batched and not transactional for the same
 * reason as Work's 0033; the rows were unreachable, so down is empty.
 */
const noPage = (column: ReturnType<typeof sql>) =>
  sql`NOT EXISTS (SELECT 1 FROM pages p WHERE p.id = ${column})`;

export default changeset({
  id: '0021-docs-remove-orphans',
  author: 'bemmoly',
  description: 'Remove links, notifications and AI rows of deleted pages and issues',
  contexts: ['*'],
  transactional: false,
  up: async (ctx) => {
    await deleteInBatches(
      ctx,
      'links',
      sql`((t.source_kind = 'page' AND ${noPage(sql`t.source_id`)})
        OR (t.target_kind = 'page' AND ${noPage(sql`t.target_id`)}))`,
    );
    const [work] = await ctx.query<{ present: boolean }>(
      sql`SELECT to_regclass('issues') IS NOT NULL AS present`,
    );
    if (work?.present) {
      await deleteInBatches(
        ctx,
        'links',
        sql`((t.source_kind = 'issue'
            AND NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = t.source_id))
          OR (t.target_kind = 'issue'
            AND NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = t.target_id)))`,
      );
    }
    await deleteInBatches(
      ctx,
      'ai_insights',
      sql`t.target_kind = 'page' AND ${noPage(sql`t.target_id`)}`,
    );
    const textTarget = noPage(textAsUuid(sql`t.target_id`));
    await deleteInBatches(ctx, 'notifications', sql`t.target_kind = 'page' AND ${textTarget}`);
    for (const table of ['embeddings', 'pending_embeddings']) {
      await deleteInBatches(ctx, table, sql`t.target_kind = 'docs.page' AND ${textTarget}`);
    }
  },
  down: async () => undefined,
});
