import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * links is polymorphic on source_kind and target_kind, so no foreign key removes a page's
 * links (mentions among them) when the page is deleted forever or its space goes. A
 * statement-level trigger on pages removes them in the same statement, with the kernel rows
 * (notifications, embeddings, insights) through purge_target_rows(). page_comments and
 * revisions already cascade by foreign key. Work removes the issue side of links itself.
 *
 * integrity_orphans_docs is what the system health check reads; it should always say zero.
 */
export default changeset({
  id: '0020-docs-dependent-cleanup',
  author: 'bemmoly',
  description: 'Remove links and kernel rows that point at deleted pages and spaces',
  contexts: ['*'],
  slow: true,
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE FUNCTION docs_pages_purge_dependents() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        ids uuid[];
      BEGIN
        SELECT array_agg(id) INTO ids FROM gone;
        IF ids IS NULL THEN
          RETURN NULL;
        END IF;
        DELETE FROM links WHERE source_kind = 'page' AND source_id = ANY (ids);
        DELETE FROM links WHERE target_kind = 'page' AND target_id = ANY (ids);
        PERFORM purge_target_rows(ids);
        RETURN NULL;
      END
      $$`);
    await ctx.exec(sql`
      CREATE FUNCTION docs_purge_target_rows() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM purge_target_rows((SELECT array_agg(id) FROM gone));
        RETURN NULL;
      END
      $$`);
    await ctx.exec(sql`
      CREATE TRIGGER pages_purge_dependents AFTER DELETE ON pages
        REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
        EXECUTE FUNCTION docs_pages_purge_dependents()`);
    await ctx.exec(sql`
      CREATE TRIGGER spaces_purge_dependents AFTER DELETE ON spaces
        REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
        EXECUTE FUNCTION docs_purge_target_rows()`);
    await ctx.exec(sql`
      CREATE VIEW integrity_orphans_docs AS
        SELECT 'links'::text AS table_name, count(*)::bigint AS orphans
          FROM links l
          WHERE (l.source_kind = 'page'
              AND NOT EXISTS (SELECT 1 FROM pages p WHERE p.id = l.source_id))
            OR (l.target_kind = 'page'
              AND NOT EXISTS (SELECT 1 FROM pages p WHERE p.id = l.target_id))`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP VIEW integrity_orphans_docs`);
    await ctx.exec(sql`DROP TRIGGER spaces_purge_dependents ON spaces`);
    await ctx.exec(sql`DROP TRIGGER pages_purge_dependents ON pages`);
    await ctx.exec(sql`DROP FUNCTION docs_purge_target_rows()`);
    await ctx.exec(sql`DROP FUNCTION docs_pages_purge_dependents()`);
  },
});
