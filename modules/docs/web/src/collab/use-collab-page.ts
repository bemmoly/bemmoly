import type { DocEditorProps } from '@bemmoly/editor';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Doc } from 'yjs';
import type { RichText } from '../../../shared/common.ts';
import { createCollabSession, type CollabSession, type CollabState } from './session.ts';
import type { CollabUser } from './user.ts';

export type CollabExtensions = NonNullable<DocEditorProps['extensions']>;

export interface CollabPage extends CollabState {
  /** The page's Yjs document; null until the person is known. */
  doc: Doc | null;
  /**
   * What DocEditor's `extensions` takes. Null while the editor half loads: mount the editor
   * once it is set, without `initialDoc`, and remount it whenever this array changes.
   */
  extensions: CollabExtensions | null;
  /** A key for the editor that changes with `extensions`, so it remounts when they do. */
  editorKey: string;
}

const IDLE: CollabState = { status: 'connecting', editable: false, unsynced: 0, peers: [] };
const idle = () => IDLE;
const noSubscription = () => () => undefined;

/** /collab on the page's own origin, so the session cookie goes with the upgrade. */
export function collabUrl(): string {
  const { protocol, host } = window.location;
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/collab`;
}

/**
 * One page body, shared live with everyone who has it open. `fallback` is the page's stored
 * snapshot: used only when no collab server answers (the dev mock), where the page becomes a
 * private document in this tab so the editor still works.
 */
export function useCollabPage(
  pageId: string | undefined,
  user: CollabUser | null,
  fallback?: RichText | null,
): CollabPage {
  const [session, setSession] = useState<CollabSession | null>(null);
  const [editor, setEditor] = useState<{ extensions: CollabExtensions; generation: number } | null>(
    null,
  );
  const setExtensions = (extensions: CollabExtensions | null) =>
    setEditor((current) =>
      extensions ? { extensions, generation: (current?.generation ?? 0) + 1 } : null,
    );
  const userKey = user ? `${user.id}|${user.name}|${user.hue}` : null;

  useEffect(() => {
    if (!pageId || !user) return;
    let alive = true;
    const loading = import('./extensions.ts');
    const created = createCollabSession({
      pageId,
      url: collabUrl(),
      user,
      onLocal: (doc) => void loading.then((editor) => alive && editor.seedLocal(doc, fallback)),
    });
    setSession(created);
    void loading.then((editor) => {
      if (alive) setExtensions(editor.collabExtensions(created, user));
    });
    return () => {
      alive = false;
      setSession(null);
      setExtensions(null);
      created.destroy();
    };
    // A new session per page and person; the fallback is read once, when needed.
  }, [pageId, userKey]);

  const state = useSyncExternalStore(
    session?.subscribe ?? noSubscription,
    session?.getState ?? idle,
    idle,
  );

  // Gone local: the provider is gone, so the carets go too; the editor remounts on the change.
  const local = state.status === 'local';
  useEffect(() => {
    if (!local || !session || !user) return;
    let alive = true;
    void import('./extensions.ts').then((editor) => {
      if (alive) setExtensions(editor.collabExtensions(session, user));
    });
    return () => {
      alive = false;
    };
  }, [local, session]);

  return {
    ...state,
    doc: session?.doc ?? null,
    extensions: editor?.extensions ?? null,
    editorKey: `${pageId ?? ''}:${editor?.generation ?? 0}`,
  };
}
