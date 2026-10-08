import type { RequestContext } from '@bemmoly/core';
import type {
  SearchHit,
  SearchQuery,
  SuggestQuery,
  Suggestion,
} from '../../../../shared/search.ts';
import {
  accessibleProjectIds,
  MODULE_RESOURCE,
  projectResource,
  requireDatabase,
  type IssueServiceDeps,
} from '../issues/deps.ts';

/*
 * Keyword search ranks the trigger-maintained search_vector (title A, key
 * and labels B, body D); the palette's prefix lookup reads the trigram
 * indexes on key and title so it answers inside the 100 ms budget. Both
 * see only the projects the actor is a member of.
 */

interface HitRow {
  id: string;
  key: string;
  project_id: string;
  title: string;
  status_id: string;
  type_id: string;
  snippet: string;
  rank: number;
}

type SuggestionRow = Omit<HitRow, 'snippet' | 'rank'>;

const toSuggestion = (row: SuggestionRow): Suggestion => ({
  id: row.id,
  key: row.key,
  projectId: row.project_id,
  title: row.title,
  statusId: row.status_id,
  typeId: row.type_id,
});

const toHit = (row: HitRow): SearchHit => ({
  ...toSuggestion(row),
  snippet: row.snippet,
  rank: Number(row.rank),
});

export function createSearchService(deps: Pick<IssueServiceDeps, 'database'>) {
  return {
    async search(ctx: RequestContext, query: SearchQuery): Promise<SearchHit[]> {
      const sql = requireDatabase(deps);
      await ctx.authz.authorize(
        ctx.actor,
        'work.issue.view',
        query.projectId ? projectResource(query.projectId) : MODULE_RESOURCE,
      );
      const projects = query.projectId ? [query.projectId] : await accessibleProjectIds(ctx, sql);
      const rows = await sql<HitRow[]>`
        with q as (select websearch_to_tsquery('english', ${query.q})
          || websearch_to_tsquery('simple', ${query.q}) as query)
        select i.id, i.key, i.project_id, i.title, i.status_id, i.type_id,
          ts_headline('english', i.title || E'\\n' || left(i.description_text, 2000), q.query,
            'MaxFragments=1, MaxWords=24, MinWords=8, StartSel=<b>, StopSel=</b>') as snippet,
          ts_rank_cd(i.search_vector, q.query) as rank
        from issues i, q
        where i.deleted_at is null
          and i.search_vector @@ q.query
          and (${projects === null} or i.project_id = any(${projects ?? []}::uuid[]))
        order by rank desc, i.id desc
        limit ${query.limit}`;
      return rows.map(toHit);
    },

    /** Key prefix first, then title prefix, then anywhere in the title: what ⌘K shows. */
    async suggest(ctx: RequestContext, query: SuggestQuery): Promise<Suggestion[]> {
      const sql = requireDatabase(deps);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', MODULE_RESOURCE);
      const projects = await accessibleProjectIds(ctx, sql);
      const term = query.q.replace(/[\\%_]/g, (char) => `\\${char}`);
      const rows = await sql<SuggestionRow[]>`
        select i.id, i.key, i.project_id, i.title, i.status_id, i.type_id
        from issues i
        where i.deleted_at is null
          and (i.key ilike ${`${term}%`} or i.title ilike ${`%${term}%`})
          and (${projects === null} or i.project_id = any(${projects ?? []}::uuid[]))
        order by (i.key ilike ${`${term}%`}) desc, (i.title ilike ${`${term}%`}) desc,
          i.updated_at desc
        limit ${query.limit}`;
      return rows.map(toSuggestion);
    },
  };
}

export type SearchService = ReturnType<typeof createSearchService>;
