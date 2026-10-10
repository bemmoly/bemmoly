import type { SqlExecutor } from '@bemmoly/core';
import { collectReferences } from '@bemmoly/editor/convert';
import type { RichText } from '../../../../shared/common.ts';
import type { LinkKind, LinkNodeKind } from '../../../../shared/links.ts';
import type { DocsServiceDeps } from '../common.ts';

/*
 * The edges a page body owns, rewritten whenever the body is extracted: a page link is a
 * "mention" of that page, an issue embed an "embed" of that issue. The body names issues by
 * key; the kernel's entity registry turns a key into an id when a module that serves issues
 * is enabled, and an unknown key simply has no edge. Hand-made "linked" edges are never
 * touched here.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const BODY_LINK_KINDS: readonly LinkKind[] = ['mention', 'embed'];

export interface BodyEdge {
  targetKind: LinkNodeKind;
  targetId: string;
  kind: LinkKind;
}

/** Resolves the body's references to edges; run outside a transaction, it may ask Work. */
export async function bodyEdges(
  deps: Pick<DocsServiceDeps, 'entities'>,
  snapshot: RichText,
  pageId: string,
): Promise<BodyEdge[]> {
  const edges = new Map<string, BodyEdge>();
  const add = (edge: BodyEdge) =>
    edges.set(`${edge.targetKind}:${edge.targetId}:${edge.kind}`, edge);
  for (const ref of collectReferences(snapshot as Parameters<typeof collectReferences>[0])) {
    if (ref.kind === 'page' && UUID.test(ref.id) && ref.id !== pageId) {
      add({ targetKind: 'page', targetId: ref.id, kind: 'mention' });
    } else if (ref.kind === 'issue' && deps.entities) {
      const issue = await deps.entities.resolve('issue', { key: ref.key });
      if (issue && UUID.test(issue.id))
        add({ targetKind: 'issue', targetId: issue.id, kind: 'embed' });
    }
  }
  return [...edges.values()];
}

/**
 * Makes the page's body edges exactly `edges`. Page targets must exist and be live; issue
 * targets were checked when they were resolved. Returns whether anything changed.
 */
export async function rewriteBodyLinks(
  tx: SqlExecutor,
  pageId: string,
  edges: readonly BodyEdge[],
  userId: string | null,
): Promise<boolean> {
  const keys = edges.map((edge) => `${edge.targetKind}:${edge.targetId}:${edge.kind}`);
  const removed = await tx`
    delete from links
    where source_kind = 'page' and source_id = ${pageId}
      and kind = any(${BODY_LINK_KINDS}::text[])
      and target_kind || ':' || target_id::text || ':' || kind <> all(${keys}::text[])`;
  if (edges.length === 0) return removed.count > 0;
  const added = await tx`
    insert into links (source_kind, source_id, target_kind, target_id, kind, created_by)
    select 'page', ${pageId}, e.target_kind, e.target_id, e.kind, ${userId}::uuid
    from unnest(
      ${edges.map((edge) => edge.targetKind)}::text[],
      ${edges.map((edge) => edge.targetId)}::uuid[],
      ${edges.map((edge) => edge.kind)}::text[]
    ) as e (target_kind, target_id, kind)
    where e.target_kind <> 'page'
      or exists (select 1 from pages p where p.id = e.target_id and p.deleted_at is null)
    on conflict (source_kind, source_id, target_kind, target_id, kind) do nothing`;
  return removed.count > 0 || added.count > 0;
}
