import type { Actor, CollabChange, SqlExecutor } from '@bemmoly/core';
import { collectReferences, plainText, wordCount } from '@bemmoly/editor/convert';
import type { RichText } from '../../../../shared/common.ts';
import {
  DOCS_REALTIME_KINDS,
  publishChange,
  requireDatabase,
  type DocsServiceDeps,
} from '../common.ts';
import { writePeriodicIfDue } from '../revisions/write.ts';
import { docToSnapshot } from './convert.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The person behind an actor, for updated_by and the audit row. */
export const personOf = (actor: Actor | null): string | null =>
  !actor || actor.kind === 'system'
    ? null
    : actor.kind === 'user'
      ? actor.id
      : (actor.userId ?? null);

/** Pages the body links to with a page link, each once. */
function linkedPageIds(snapshot: RichText, pageId: string): string[] {
  const ids = collectReferences(snapshot as Parameters<typeof collectReferences>[0]).flatMap(
    (ref) => (ref.kind === 'page' && UUID.test(ref.id) && ref.id !== pageId ? [ref.id] : []),
  );
  return [...new Set(ids)];
}

/**
 * Rewrites the page-to-page edges the body owns. Issue references are kept as they are: the
 * body names issues by key, and resolving a key to an id is Work's business, not Docs'.
 */
async function rewritePageLinks(
  tx: SqlExecutor,
  pageId: string,
  targets: string[],
  userId: string | null,
): Promise<void> {
  await tx`
    delete from links
    where source_kind = 'page' and source_id = ${pageId} and target_kind = 'page'
      and target_id <> all(${targets}::uuid[])`;
  if (targets.length === 0) return;
  await tx`
    insert into links (source_kind, source_id, target_kind, target_id, kind, created_by)
    select 'page', ${pageId}, 'page', p.id, 'mention', ${userId}::uuid
    from pages p
    where p.id = any(${targets}::uuid[]) and p.deleted_at is null
    on conflict (source_kind, source_id, target_kind, target_id, kind) do nothing`;
}

/**
 * The debounced collab hook: writes the body's ProseMirror snapshot, plain text and word
 * count into pages (search_vector follows by trigger), rewrites the page's links, records who
 * edited in the audit log, writes the periodic revision when one is due and tells open screens. A change that leaves the body as it was
 * (typing then undoing) writes nothing.
 */
export async function extractPage(deps: DocsServiceDeps, change: CollabChange): Promise<void> {
  const sql = requireDatabase(deps);
  const snapshot = docToSnapshot(change.doc);
  const text = plainText(snapshot as Parameters<typeof plainText>[0]);
  const words = wordCount(snapshot as Parameters<typeof wordCount>[0]);
  const editors = [...new Set(change.editors.map(personOf).filter((id) => id !== null))];
  const lastEditor = editors.at(-1) ?? null;
  const json = JSON.stringify(snapshot);
  const result = await sql.begin(async (tx) => {
    const [updated] = await tx<{ space_id: string }[]>`
      update pages set
        snapshot = ${json}::jsonb,
        text = ${text},
        word_count = ${words},
        content_updated_at = now(),
        updated_by = coalesce(${lastEditor}::uuid, updated_by),
        updated_at = now(),
        revision_editor_ids = array(
          select distinct unnest(revision_editor_ids || ${editors}::uuid[])),
        revision_pending_since = coalesce(revision_pending_since, now())
      where id = ${change.id} and deleted_at is null
        and (snapshot is distinct from ${json}::jsonb or text is distinct from ${text})
      returning space_id`;
    if (!updated) return null;
    await rewritePageLinks(tx, change.id, linkedPageIds(snapshot, change.id), lastEditor);
    await deps.audit?.record(
      {
        actor: change.editors.at(-1) ?? { kind: 'system', id: 'docs.collab' },
        action: 'page.content_edited',
        target: { kind: 'page', id: change.id },
        after: { editors, wordCount: words },
      },
      tx,
    );
    const periodic = await writePeriodicIfDue(tx, change.id);
    return { spaceId: updated.space_id, revised: periodic !== null };
  });
  if (!result) return;
  await publishChange(deps, DOCS_REALTIME_KINDS.page, result.spaceId, [change.id]);
  if (result.revised) {
    await publishChange(deps, DOCS_REALTIME_KINDS.revisions, result.spaceId, [change.id]);
  }
}
