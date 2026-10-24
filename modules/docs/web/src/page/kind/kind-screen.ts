import type { PageDetail } from '@bemmoly/module-docs/shared';
import type { CollabPage } from '../../collab/use-collab-page.ts';
import { statsOf } from '../body/doc-stats.ts';
import type { PageScreenState, ReadOnlyReason } from '../screen-context.ts';

/**
 * The page screen's shared state for a page with no live body (a file page, a folder; ADR
 * 0049), so the header's trail, status, star, Share and banners work unchanged. Nothing is
 * edited live here: the collab state says only whether the person may change the page.
 */
export function kindScreen(page: PageDetail, readOnly: ReadOnlyReason): PageScreenState {
  const collab: CollabPage = {
    status: readOnly === 'viewer' ? 'read-only' : 'live',
    editable: readOnly === null,
    unsynced: 0,
    peers: [],
    doc: null,
    extensions: null,
    editorKey: page.id,
  };
  return {
    page,
    collab,
    editable: readOnly === null,
    readOnly,
    editor: null,
    focusBody: () => undefined,
    outline: [],
    activeHeading: null,
    pinHeading: () => undefined,
    docked: false,
    stats: statsOf(0),
  };
}

/**
 * Why the page cannot be changed: trashed or archived. Who may edit is a space rule the
 * client learns only from a live body, so, as in the sidebar tree, the actions show and the
 * server refuses one the person may not take.
 */
export function kindReadOnly(page: PageDetail): ReadOnlyReason {
  if (page.deletedAt) return 'trashed';
  if (page.status === 'archived') return 'archived';
  return null;
}
