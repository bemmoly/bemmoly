import type { EntitySummary, SqlExecutor } from '@bemmoly/core';
import type { RichText } from '../../../../shared/common.ts';
import type { DocsServiceDeps } from '../common.ts';

/** The reads pageContext and the consistency check make. Dates arrive as strings. */

export interface PageFacts {
  id: string;
  title: string;
  status: string;
  spaceId: string;
  spaceKey: string;
  spaceExcluded: boolean;
  authorId: string | null;
  snapshot: RichText | null;
  text: string;
  tldr: string | null;
  tldrSourceHash: string | null;
  updatedAt: string;
}

export async function readPage(sql: SqlExecutor, id: string): Promise<PageFacts | null> {
  const [row] = await sql<PageFacts[]>`
    select p.id, p.title, p.status, p.space_id as "spaceId", s.key as "spaceKey",
      s.ai_excluded as "spaceExcluded", coalesce(p.owner_id, p.created_by) as "authorId",
      p.snapshot, p.text, p.tldr, p.tldr_source_hash as "tldrSourceHash",
      p.updated_at::text as "updatedAt"
    from pages p join spaces s on s.id = p.space_id
    where p.id = ${id} and p.deleted_at is null`;
  return row ?? null;
}

export interface OpenComment {
  id: string;
  authorId: string | null;
  author: string | null;
  body: string;
  quote: string | null;
  createdAt: string;
}

/** Open threads' comments, oldest thread first, at most `limit`. */
export async function readOpenComments(
  sql: SqlExecutor,
  pageId: string,
  limit: number,
): Promise<OpenComment[]> {
  return sql<OpenComment[]>`
    select c.id, c.author_id as "authorId", u.name as author, c.body_text as body,
      root.anchor->>'quote' as quote, c.created_at::text as "createdAt"
    from page_comments c
    join page_comments root on root.id = coalesce(c.parent_id, c.id)
    left join users u on u.id = c.author_id
    where c.page_id = ${pageId} and c.deleted_at is null
      and root.resolved_at is null and root.deleted_at is null
    order by root.created_at, c.parent_id nulls first, c.created_at
    limit ${limit}`;
}

/** The issues the page embeds or names, as the module serving issues describes them. */
export async function readLinkedIssues(
  sql: SqlExecutor,
  deps: Pick<DocsServiceDeps, 'entities'>,
  pageId: string,
): Promise<EntitySummary[]> {
  if (!deps.entities?.resolveMany) return [];
  if (deps.entities.has && !deps.entities.has('issue')) return [];
  const rows = await sql<{ target_id: string }[]>`
    select distinct target_id from links
    where source_kind = 'page' and source_id = ${pageId} and target_kind = 'issue'`;
  if (rows.length === 0) return [];
  const found = await deps.entities.resolveMany(
    'issue',
    rows.map((row) => ({ id: row.target_id })),
  );
  return [...found].sort((a, b) => (a.key ?? '').localeCompare(b.key ?? ''));
}

export interface LinkingPage {
  id: string;
  title: string;
  spaceId: string;
  spaceExcluded: boolean;
  authorId: string | null;
  tldr: string | null;
}

/** Live pages that link a page or an issue, most recently edited first. */
export async function readPagesLinking(
  sql: SqlExecutor,
  target: { kind: 'page' | 'issue'; id: string },
  limit: number,
): Promise<LinkingPage[]> {
  return sql<LinkingPage[]>`
    select p.id, p.title, p.space_id as "spaceId", s.ai_excluded as "spaceExcluded",
      coalesce(p.owner_id, p.created_by) as "authorId", p.tldr
    from pages p join spaces s on s.id = p.space_id
    where p.deleted_at is null and p.id in (
      select source_id from links
      where source_kind = 'page' and target_kind = ${target.kind} and target_id = ${target.id})
      and p.id <> ${target.id}
    order by p.content_updated_at desc nulls last, p.id
    limit ${limit}`;
}

/** Statuses for the issue keys a page names, for pairing claims with fields. */
export function statusOf(issue: EntitySummary): string {
  const status = (issue.data?.['status'] as { name?: string } | null | undefined)?.name;
  return status ?? 'unknown status';
}

export function projectOf(issue: EntitySummary): string | null {
  const projectId = issue.data?.['projectId'];
  return typeof projectId === 'string' ? projectId : null;
}
