import type { SqlExecutor } from '@bemmoly/core';
import type { PageStatus } from '../../../../shared/common.ts';
import type { LinkedPage, LinkKind, LinkNodeKind } from '../../../../shared/links.ts';

/*
 * The reads behind the links panels. Every one takes the spaces the person may see (null for
 * all), so a title from a space they are not in never leaves the database.
 */

export interface LinkedPageRow {
  page_id: string;
  space_key: string;
  title: string;
  icon: string | null;
  status: PageStatus;
  kind: LinkKind;
}

export const toLinkedPage = (row: LinkedPageRow): LinkedPage => ({
  pageId: row.page_id,
  spaceKey: row.space_key,
  title: row.title,
  icon: row.icon,
  status: row.status,
  kind: row.kind,
});

export interface OutgoingRow {
  target_kind: LinkNodeKind;
  target_id: string;
  kind: LinkKind;
  page_id: string | null;
  space_id: string | null;
  space_key: string | null;
  title: string | null;
  icon: string | null;
  status: PageStatus | null;
}

/** Every edge out of the page, page targets joined to their page when it is live. */
export async function outgoingRows(sql: SqlExecutor, pageId: string): Promise<OutgoingRow[]> {
  return sql<OutgoingRow[]>`
    select l.target_kind, l.target_id, l.kind, p.id as page_id, p.space_id, s.key as space_key,
      p.title, p.icon, p.status
    from links l
    left join pages p on l.target_kind = 'page' and p.id = l.target_id and p.deleted_at is null
    left join spaces s on s.id = p.space_id
    where l.source_kind = 'page' and l.source_id = ${pageId}
    order by l.created_at, l.id`;
}

/**
 * Live pages that point at a target, one row per page (its strongest edge: an embed over a
 * mention over a hand-made link), most recently linked first.
 */
export async function pagesPointingAt(
  sql: SqlExecutor,
  target: { kind: LinkNodeKind; id: string },
  visible: string[] | null,
  limit = 200,
): Promise<LinkedPageRow[]> {
  return sql<LinkedPageRow[]>`
    select page_id, space_key, title, icon, status, kind from (
      select distinct on (p.id) p.id as page_id, s.key as space_key, p.title, p.icon, p.status,
        l.kind, l.created_at
      from links l
      join pages p on p.id = l.source_id and p.deleted_at is null
      join spaces s on s.id = p.space_id
      where l.source_kind = 'page' and l.target_kind = ${target.kind}
        and l.target_id = ${target.id}
        ${visible ? sql`and p.space_id = any(${visible}::uuid[])` : sql``}
      order by p.id, array_position(array['embed', 'mention', 'linked'], l.kind), l.created_at desc
    ) edges
    order by created_at desc, page_id
    limit ${limit}`;
}

/** Edges into the page from records other modules own (an issue linking a spec). */
export async function foreignSources(
  sql: SqlExecutor,
  pageId: string,
): Promise<{ source_kind: string; source_id: string; kind: LinkKind }[]> {
  return sql`
    select source_kind, source_id, kind from links
    where target_kind = 'page' and target_id = ${pageId} and source_kind <> 'page'
    order by created_at desc, id
    limit 200`;
}
