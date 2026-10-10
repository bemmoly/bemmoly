import type { RequestContext } from '@bemmoly/core';
import type {
  PageSearchHit,
  PageSuggestion,
  SearchPagesQuery,
  SuggestPagesQuery,
} from '../../../../shared/search.ts';
import {
  DOCS_MODULE,
  requireDatabase,
  spaceResource,
  visibleSpaceIds,
  type DocsServiceDeps,
} from '../common.ts';

/*
 * Keyword search ranks the trigger-maintained search_vector (title A, labels
 * B, body D); the palette's lookup reads the trigram index on title so it
 * answers inside the 100 ms budget. Both see only the spaces the actor is a
 * member of and never a page in the trash or in an archived space.
 */

interface SuggestionRow {
  id: string;
  space_id: string;
  space_key: string;
  title: string;
  icon: string | null;
  status: PageSuggestion['status'];
  space_name: string;
  parent_title: string | null;
}

interface HitRow extends SuggestionRow {
  snippet: string;
  rank: number;
}

const toSuggestion = (row: SuggestionRow): PageSuggestion => ({
  id: row.id,
  spaceId: row.space_id,
  spaceKey: row.space_key,
  title: row.title,
  icon: row.icon,
  status: row.status,
  spaceName: row.space_name,
  parentTitle: row.parent_title,
});

const PLACE_COLUMNS = `s.name as space_name, up.title as parent_title`;

export function createSearchService(deps: DocsServiceDeps) {
  return {
    async search(ctx: RequestContext, query: SearchPagesQuery): Promise<PageSearchHit[]> {
      const sql = requireDatabase(deps);
      await ctx.authz.authorize(
        ctx.actor,
        'docs.page.view',
        query.spaceId ? spaceResource(query.spaceId) : DOCS_MODULE,
      );
      const spaces = query.spaceId ? [query.spaceId] : await visibleSpaceIds(sql, ctx);
      const rows = await sql<HitRow[]>`
        with q as (select websearch_to_tsquery('english', ${query.q})
          || websearch_to_tsquery('simple', ${query.q}) as query)
        select p.id, p.space_id, s.key as space_key, p.title, p.icon, p.status,
          ${sql.unsafe(PLACE_COLUMNS)},
          ts_headline('english', p.title || E'\\n' || left(p.text, 2000), q.query,
            'MaxFragments=1, MaxWords=24, MinWords=8, StartSel=<b>, StopSel=</b>') as snippet,
          ts_rank_cd(p.search_vector, q.query) as rank
        from pages p join spaces s on s.id = p.space_id
          left join pages up on up.id = p.parent_id, q
        where p.deleted_at is null and s.archived_at is null
          and p.search_vector @@ q.query
          and (${spaces === null} or p.space_id = any(${spaces ?? []}::uuid[]))
        order by rank desc, p.updated_at desc, p.id desc
        limit ${query.limit}`;
      return rows.map((row) => ({
        ...toSuggestion(row),
        snippet: row.snippet,
        rank: Number(row.rank),
      }));
    },

    /** Title prefix first, then anywhere in the title, most recently edited first. */
    async suggest(ctx: RequestContext, query: SuggestPagesQuery): Promise<PageSuggestion[]> {
      const sql = requireDatabase(deps);
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', DOCS_MODULE);
      const spaces = await visibleSpaceIds(sql, ctx);
      const term = query.q.replace(/[\\%_]/g, (char) => `\\${char}`);
      const rows = await sql<SuggestionRow[]>`
        select p.id, p.space_id, s.key as space_key, p.title, p.icon, p.status,
          ${sql.unsafe(PLACE_COLUMNS)}
        from pages p join spaces s on s.id = p.space_id
          left join pages up on up.id = p.parent_id
        where p.deleted_at is null and s.archived_at is null
          and p.title ilike ${`%${term}%`}
          and (${spaces === null} or p.space_id = any(${spaces ?? []}::uuid[]))
        order by (p.title ilike ${`${term}%`}) desc, p.updated_at desc, p.id desc
        limit ${query.limit}`;
      return rows.map(toSuggestion);
    },
  };
}

export type SearchService = ReturnType<typeof createSearchService>;
