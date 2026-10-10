import type { SearchResult } from '@bemmoly/shared';
import type {
  RequestContext,
  SearchProviderDefinition,
  SearchProviderQuery,
  SearchRegistry,
  SqlClient,
} from '@bemmoly/core';
import { issuePath } from '../issues/notify.ts';
import type { SearchService } from '../search/index.ts';

/** The palette's kind for Work results, and the group they show under. */
export const WORK_ISSUE_SEARCH = { kind: 'work.issue', label: 'Issues' } as const;

/** "PLT", "plt-", "PLT-14": what someone types when they know the key. */
const KEY_LIKE = /^[a-z][a-z0-9]{0,9}(-\d*)?$/i;

interface Found {
  id: string;
  key: string;
  title: string;
  statusId: string;
}

interface Details {
  subtitle: string;
  look: NonNullable<SearchResult['look']>;
}

interface DetailRow {
  id: string;
  status: string | null;
  category: 'todo' | 'in_progress' | 'done' | null;
  assignee: string | null;
  type_key: string;
  type_icon: string | null;
  type_color: string | null;
  type_level: string | null;
}

/** "In review · Aisha", and the type and status ⌘K draws the row with. */
async function details(sql: SqlClient, found: readonly Found[]) {
  if (found.length === 0) return new Map<string, Details>();
  const rows = await sql<DetailRow[]>`
    select i.id, s.name as status, s.category, u.name as assignee,
           t.key as type_key, t.icon as type_icon, t.color as type_color, t.level as type_level
    from issues i
    join issue_types t on t.id = i.type_id
    left join workflow_statuses s on s.id = i.status_id
    left join users u on u.id = i.assignee_id
    where i.id = any(${found.map((issue) => issue.id)}::uuid[])`;
  return new Map(
    rows.map((row) => [
      row.id,
      {
        subtitle: [row.status, row.assignee].filter(Boolean).join(' · '),
        look: {
          type: {
            key: row.type_key,
            icon: row.type_icon,
            color: row.type_color,
            level: row.type_level,
          },
          ...(row.status && row.category
            ? { status: { category: row.category, name: row.status } }
            : {}),
        },
      },
    ]),
  );
}

/**
 * Issues for ⌘K: a key-like query asks the key prefix lookup first, then
 * every query asks keyword search, and the two are merged without repeats.
 * Both already keep to the projects the person is in.
 */
export function createIssueSearchProvider(
  search: SearchService,
  database: SqlClient | undefined,
): SearchProviderDefinition {
  return {
    ...WORK_ISSUE_SEARCH,
    async search(ctx: RequestContext, query: SearchProviderQuery) {
      const q = query.q.trim();
      const byKey = KEY_LIKE.test(q)
        ? await search.suggest(ctx, { q, limit: Math.min(query.limit, 20) })
        : [];
      const byWords = await search.search(ctx, { q: q.slice(0, 200), limit: query.limit });
      const merged = new Map<string, Found>();
      for (const issue of [...byKey, ...byWords]) {
        if (!merged.has(issue.id)) merged.set(issue.id, issue);
      }
      const found = [...merged.values()].slice(0, query.limit);
      const meta = database ? await details(database, found) : new Map<string, Details>();
      return found.map((issue) => {
        const known = meta.get(issue.id);
        return {
          id: issue.id,
          key: issue.key,
          title: issue.title,
          subtitle: known?.subtitle || null,
          href: issuePath(issue.key),
          ...(known ? { look: known.look } : {}),
        };
      });
    },
  };
}

/** One line in module.ts: Work answers the palette with issues. */
export function registerWorkSearch(
  registry: SearchRegistry,
  search: SearchService,
  database: SqlClient | undefined,
): void {
  registry.addProvider(createIssueSearchProvider(search, database));
}
