import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Notifications, embeddings, pending embeddings and AI insights point at module records by
 * (target_kind, target_id), so no foreign key can remove them with the record. Modules call
 * this from their delete triggers with the ids that went. Ids are UUIDv7 and unique across
 * every kind, so matching on the id alone is exact and needs no list of kind names here.
 */
export default changeset({
  id: '0703-purge-target-rows',
  author: 'bemmoly',
  description: 'Add purge_target_rows(), which removes kernel rows that point at deleted records',
  contexts: ['*'],
  slow: true,
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE FUNCTION purge_target_rows(ids uuid[]) RETURNS void
      LANGUAGE plpgsql AS $$
      DECLARE
        texts text[];
      BEGIN
        IF ids IS NULL OR cardinality(ids) = 0 THEN
          RETURN;
        END IF;
        texts := ids::text[];
        DELETE FROM notifications WHERE target_id = ANY (texts);
        DELETE FROM embeddings WHERE target_id = ANY (texts);
        DELETE FROM pending_embeddings WHERE target_id = ANY (texts);
        DELETE FROM ai_insights WHERE target_id = ANY (ids);
      END
      $$`);
    await ctx.exec(sql`
      CREATE INDEX notifications_target_id_idx ON notifications (target_id)`);
    await ctx.exec(sql`
      CREATE INDEX embeddings_target_id_idx ON embeddings (target_id)`);
    await ctx.exec(sql`
      CREATE INDEX pending_embeddings_target_id_idx ON pending_embeddings (target_id)`);
    await ctx.exec(sql`
      CREATE INDEX ai_insights_target_id_idx ON ai_insights (target_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP INDEX ai_insights_target_id_idx`);
    await ctx.exec(sql`DROP INDEX pending_embeddings_target_id_idx`);
    await ctx.exec(sql`DROP INDEX embeddings_target_id_idx`);
    await ctx.exec(sql`DROP INDEX notifications_target_id_idx`);
    await ctx.exec(sql`DROP FUNCTION purge_target_rows(uuid[])`);
  },
});
