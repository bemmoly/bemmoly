import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * search_vector is kept by triggers, as Work keeps issues', because the page
 * service, the collab hook and the labels service all touch what it indexes.
 * Weights as the tech design gives them: title A, labels B, body D.
 */
export default changeset({
  id: '0011-docs-page-search-vector',
  author: 'bemmoly',
  description: 'Maintain pages.search_vector with triggers on pages and page_labels',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE FUNCTION docs_page_search_vector(p_id uuid, p_title text, p_text text)
      RETURNS tsvector LANGUAGE sql STABLE AS $$
        SELECT setweight(to_tsvector('english', coalesce(p_title, '')), 'A')
          || setweight(to_tsvector('simple', coalesce((
               SELECT string_agg(pl.name, ' ') FROM page_labels pl WHERE pl.page_id = p_id
             ), '')), 'B')
          || setweight(to_tsvector('english', left(coalesce(p_text, ''), 100000)), 'D')
      $$`);
    await ctx.exec(sql`
      CREATE FUNCTION docs_pages_search_vector_trigger() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        NEW.search_vector := docs_page_search_vector(NEW.id, NEW.title, NEW.text);
        RETURN NEW;
      END
      $$`);
    await ctx.exec(sql`
      CREATE TRIGGER pages_search_vector_trg
        BEFORE INSERT OR UPDATE OF title, text ON pages
        FOR EACH ROW EXECUTE FUNCTION docs_pages_search_vector_trigger()`);
    await ctx.exec(sql`
      CREATE FUNCTION docs_page_labels_search_vector_trigger() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        v_page_id uuid := coalesce(NEW.page_id, OLD.page_id);
      BEGIN
        UPDATE pages SET search_vector = docs_page_search_vector(id, title, text)
          WHERE id = v_page_id;
        RETURN NULL;
      END
      $$`);
    await ctx.exec(sql`
      CREATE TRIGGER page_labels_search_vector_trg
        AFTER INSERT OR DELETE ON page_labels
        FOR EACH ROW EXECUTE FUNCTION docs_page_labels_search_vector_trigger()`);
    await ctx.exec(sql`
      UPDATE pages SET search_vector = docs_page_search_vector(id, title, text)
      WHERE search_vector IS NULL`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TRIGGER page_labels_search_vector_trg ON page_labels`);
    await ctx.exec(sql`DROP FUNCTION docs_page_labels_search_vector_trigger()`);
    await ctx.exec(sql`DROP TRIGGER pages_search_vector_trg ON pages`);
    await ctx.exec(sql`DROP FUNCTION docs_pages_search_vector_trigger()`);
    await ctx.exec(sql`DROP FUNCTION docs_page_search_vector(uuid, text, text)`);
  },
});
