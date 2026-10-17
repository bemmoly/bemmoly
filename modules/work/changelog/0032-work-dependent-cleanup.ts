import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * comments, attachments and watchers are polymorphic on target_kind, so no foreign key ties
 * them to issues, and a deleted project left them behind. A statement-level trigger on each
 * owner table removes them in the same statement, which covers every path: a project delete
 * cascading to its issues, the batched purge job, and any later hard delete. Kernel rows
 * (notifications, embeddings, insights) go through the kernel's purge_target_rows(). links
 * belongs to Docs, which may be off, so it is looked up at run time. Reactions live on the
 * comment row and mentions are links rows, so both go with them.
 *
 * integrity_orphans_work is what the system health check reads: one row per table with the
 * rows whose target is gone. It should always say zero now.
 */
export default changeset({
  id: '0032-work-dependent-cleanup',
  author: 'bemmoly',
  description: 'Remove rows that point at deleted issues, comments, sprints and projects',
  contexts: ['*'],
  slow: true,
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE FUNCTION work_issues_purge_dependents() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        ids uuid[];
      BEGIN
        SELECT array_agg(id) INTO ids FROM gone;
        IF ids IS NULL THEN
          RETURN NULL;
        END IF;
        DELETE FROM comments WHERE target_kind = 'issue' AND target_id = ANY (ids);
        DELETE FROM attachments WHERE target_kind = 'issue' AND target_id = ANY (ids);
        DELETE FROM watchers WHERE target_kind = 'issue' AND target_id = ANY (ids);
        IF to_regclass('links') IS NOT NULL THEN
          EXECUTE 'DELETE FROM links WHERE (source_kind = ''issue'' AND source_id = ANY ($1))
            OR (target_kind = ''issue'' AND target_id = ANY ($1))' USING ids;
        END IF;
        PERFORM purge_target_rows(ids);
        RETURN NULL;
      END
      $$`);
    await ctx.exec(sql`
      CREATE FUNCTION work_comments_purge_dependents() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        ids uuid[];
      BEGIN
        SELECT array_agg(id) INTO ids FROM gone;
        IF ids IS NULL THEN
          RETURN NULL;
        END IF;
        DELETE FROM attachments WHERE target_kind = 'comment' AND target_id = ANY (ids);
        PERFORM purge_target_rows(ids);
        RETURN NULL;
      END
      $$`);
    await ctx.exec(sql`
      CREATE FUNCTION work_purge_target_rows() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM purge_target_rows((SELECT array_agg(id) FROM gone));
        RETURN NULL;
      END
      $$`);
    await ctx.exec(sql`
      CREATE TRIGGER issues_purge_dependents AFTER DELETE ON issues
        REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
        EXECUTE FUNCTION work_issues_purge_dependents()`);
    await ctx.exec(sql`
      CREATE TRIGGER comments_purge_dependents AFTER DELETE ON comments
        REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
        EXECUTE FUNCTION work_comments_purge_dependents()`);
    await ctx.exec(sql`
      CREATE TRIGGER sprints_purge_dependents AFTER DELETE ON sprints
        REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
        EXECUTE FUNCTION work_purge_target_rows()`);
    await ctx.exec(sql`
      CREATE TRIGGER projects_purge_dependents AFTER DELETE ON projects
        REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
        EXECUTE FUNCTION work_purge_target_rows()`);
    await ctx.exec(sql`CREATE INDEX comments_target_id_idx ON comments (target_id)`);
    await ctx.exec(sql`
      CREATE VIEW integrity_orphans_work AS
        SELECT 'comments'::text AS table_name, count(*)::bigint AS orphans
          FROM comments c
          WHERE c.target_kind = 'issue'
            AND NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = c.target_id)
        UNION ALL
        SELECT 'attachments', count(*)
          FROM attachments a
          WHERE (a.target_kind = 'issue'
              AND NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = a.target_id))
            OR (a.target_kind = 'comment'
              AND NOT EXISTS (SELECT 1 FROM comments c WHERE c.id = a.target_id))
        UNION ALL
        SELECT 'watchers', count(*)
          FROM watchers w
          WHERE w.target_kind = 'issue'
            AND NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = w.target_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP VIEW integrity_orphans_work`);
    await ctx.exec(sql`DROP INDEX comments_target_id_idx`);
    await ctx.exec(sql`DROP TRIGGER projects_purge_dependents ON projects`);
    await ctx.exec(sql`DROP TRIGGER sprints_purge_dependents ON sprints`);
    await ctx.exec(sql`DROP TRIGGER comments_purge_dependents ON comments`);
    await ctx.exec(sql`DROP TRIGGER issues_purge_dependents ON issues`);
    await ctx.exec(sql`DROP FUNCTION work_purge_target_rows()`);
    await ctx.exec(sql`DROP FUNCTION work_comments_purge_dependents()`);
    await ctx.exec(sql`DROP FUNCTION work_issues_purge_dependents()`);
  },
});
