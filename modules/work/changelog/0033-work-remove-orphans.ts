import { changeset, deleteInBatches, sql, textAsUuid } from '@bemmoly/core/changelog';

/*
 * Removes the rows earlier project deletes left behind, now that 0032 stops new ones. Not
 * transactional: each batch commits on its own, so a workspace with hundreds of thousands
 * of orphans never holds one long lock, and a rerun after a crash picks up what is left
 * (a batch only deletes rows whose target is already gone). The rows were unreachable, so
 * there is nothing to put back and down is empty.
 */
const noIssue = (column: ReturnType<typeof sql>) =>
  sql`NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = ${column})`;

export default changeset({
  id: '0033-work-remove-orphans',
  author: 'bemmoly',
  description: 'Remove comments, attachments, watchers and kernel rows of deleted issues',
  contexts: ['*'],
  transactional: false,
  up: async (ctx) => {
    const target = sql`t.target_id`;
    await deleteInBatches(ctx, 'comments', sql`t.target_kind = 'issue' AND ${noIssue(target)}`);
    await deleteInBatches(
      ctx,
      'attachments',
      sql`((t.target_kind = 'issue' AND ${noIssue(target)})
        OR (t.target_kind = 'comment'
          AND NOT EXISTS (SELECT 1 FROM comments c WHERE c.id = t.target_id)))`,
    );
    await deleteInBatches(ctx, 'watchers', sql`t.target_kind = 'issue' AND ${noIssue(target)}`);
    await deleteInBatches(ctx, 'ai_insights', sql`t.target_kind = 'issue' AND ${noIssue(target)}`);
    const textTarget = noIssue(textAsUuid(sql`t.target_id`));
    await deleteInBatches(ctx, 'notifications', sql`t.target_kind = 'issue' AND ${textTarget}`);
    for (const table of ['embeddings', 'pending_embeddings']) {
      await deleteInBatches(ctx, table, sql`t.target_kind = 'work.issue' AND ${textTarget}`);
    }
  },
  down: async () => undefined,
});
