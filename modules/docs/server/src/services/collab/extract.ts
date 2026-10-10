import type { Actor, CollabChange } from '@bemmoly/core';
import { plainText, wordCount } from '@bemmoly/editor/convert';
import {
  DOCS_REALTIME_KINDS,
  publishChange,
  requireDatabase,
  type DocsServiceDeps,
} from '../common.ts';
import { bodyEdges, rewriteBodyLinks } from '../links/rewrite.ts';
import { writePeriodicIfDue } from '../revisions/write.ts';
import { docToSnapshot } from './convert.ts';

/** The person behind an actor, for updated_by and the audit row. */
export const personOf = (actor: Actor | null): string | null =>
  !actor || actor.kind === 'system'
    ? null
    : actor.kind === 'user'
      ? actor.id
      : (actor.userId ?? null);

/**
 * The debounced collab hook: writes the body's ProseMirror snapshot, plain text and word
 * count into pages (search_vector follows by trigger), rewrites the links the body owns,
 * records who edited in the audit log, writes the periodic revision when one is due and tells
 * open screens. A change that leaves the body as it was (typing then undoing) writes nothing.
 */
export async function extractPage(deps: DocsServiceDeps, change: CollabChange): Promise<void> {
  const sql = requireDatabase(deps);
  const snapshot = docToSnapshot(change.doc);
  const text = plainText(snapshot as Parameters<typeof plainText>[0]);
  const words = wordCount(snapshot as Parameters<typeof wordCount>[0]);
  const editors = [...new Set(change.editors.map(personOf).filter((id) => id !== null))];
  const lastEditor = editors.at(-1) ?? null;
  const json = JSON.stringify(snapshot);
  const edges = await bodyEdges(deps, snapshot, change.id);
  const result = await sql.begin(async (tx) => {
    const [updated] = await tx<{ space_id: string }[]>`
      update pages set
        snapshot = ${json}::jsonb,
        text = ${text},
        word_count = ${words},
        content_updated_at = now(),
        content_updated_by = coalesce(${lastEditor}::uuid, content_updated_by),
        updated_by = coalesce(${lastEditor}::uuid, updated_by),
        updated_at = now(),
        revision_editor_ids = array(
          select distinct unnest(revision_editor_ids || ${editors}::uuid[])),
        revision_pending_since = coalesce(revision_pending_since, now())
      where id = ${change.id} and deleted_at is null
        and (snapshot is distinct from ${json}::jsonb or text is distinct from ${text})
      returning space_id`;
    if (!updated) return null;
    const relinked = await rewriteBodyLinks(tx, change.id, edges, lastEditor);
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
    return { spaceId: updated.space_id, revised: periodic !== null, relinked };
  });
  if (!result) return;
  await publishChange(deps, DOCS_REALTIME_KINDS.page, result.spaceId, [change.id]);
  if (result.revised) {
    await publishChange(deps, DOCS_REALTIME_KINDS.revisions, result.spaceId, [change.id]);
  }
  if (result.relinked) {
    await publishChange(deps, DOCS_REALTIME_KINDS.links, result.spaceId, [change.id]);
  }
}
