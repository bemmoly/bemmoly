import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * search_vector is maintained in the database, not by the issue service,
 * because more than one writer touches what it indexes: the labels service
 * attaches labels, sprint and rank jobs rewrite rows, importers insert in
 * bulk. A trigger keeps every path honest and the weights in one place:
 * title A, key and labels B, description D, as the tech design gives them.
 */
export default changeset({
  id: '0019-work-issue-search-vector',
  author: 'bemmoly',
  description: 'Maintain issues.search_vector with triggers on issues and issue_labels',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE FUNCTION work_issue_search_vector(
        p_id uuid, p_key text, p_title text, p_description_text text
      ) RETURNS tsvector LANGUAGE sql STABLE AS $$
        SELECT setweight(to_tsvector('english', coalesce(p_title, '')), 'A')
          || setweight(to_tsvector('simple', coalesce(p_key, '')), 'B')
          || setweight(to_tsvector('simple', coalesce((
               SELECT string_agg(l.name, ' ')
               FROM issue_labels il JOIN labels l ON l.id = il.label_id
               WHERE il.issue_id = p_id), '')), 'B')
          || setweight(to_tsvector('english', left(coalesce(p_description_text, ''), 100000)), 'D')
      $$`);
    await ctx.exec(sql`
      CREATE FUNCTION work_issues_search_vector_trigger() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        NEW.search_vector := work_issue_search_vector(
          NEW.id, NEW.key, NEW.title, NEW.description_text);
        RETURN NEW;
      END
      $$`);
    await ctx.exec(sql`
      CREATE TRIGGER issues_search_vector_trg
        BEFORE INSERT OR UPDATE OF key, title, description_text ON issues
        FOR EACH ROW EXECUTE FUNCTION work_issues_search_vector_trigger()`);
    await ctx.exec(sql`
      CREATE FUNCTION work_issue_labels_search_vector_trigger() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        v_issue_id uuid := coalesce(NEW.issue_id, OLD.issue_id);
      BEGIN
        UPDATE issues
          SET search_vector = work_issue_search_vector(id, key, title, description_text)
          WHERE id = v_issue_id;
        RETURN NULL;
      END
      $$`);
    await ctx.exec(sql`
      CREATE TRIGGER issue_labels_search_vector_trg
        AFTER INSERT OR DELETE ON issue_labels
        FOR EACH ROW EXECUTE FUNCTION work_issue_labels_search_vector_trigger()`);
    await ctx.exec(sql`
      UPDATE issues SET search_vector = work_issue_search_vector(id, key, title, description_text)
      WHERE search_vector IS NULL`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TRIGGER issue_labels_search_vector_trg ON issue_labels`);
    await ctx.exec(sql`DROP FUNCTION work_issue_labels_search_vector_trigger()`);
    await ctx.exec(sql`DROP TRIGGER issues_search_vector_trg ON issues`);
    await ctx.exec(sql`DROP FUNCTION work_issues_search_vector_trigger()`);
    await ctx.exec(sql`DROP FUNCTION work_issue_search_vector(uuid, text, text, text)`);
  },
});
