import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { Doc } from 'yjs';
import type { CollabUser } from './user.ts';

/**
 * What the editor screen shows about the page's connection: still connecting, live and
 * editable, offline (edits stay in the tab and merge on reconnect), connected read-only,
 * refused, or local (no collab server, as in the dev mock: a private document in the tab).
 */
export type CollabStatus = 'connecting' | 'live' | 'offline' | 'read-only' | 'denied' | 'local';

export interface CollabState {
  status: CollabStatus;
  /**
   * Whether the person may type: live, local, or offline after a first sync with write access
   * (those edits merge when the socket returns). Never before the server said who may write.
   */
  editable: boolean;
  /** Local changes the server has not confirmed yet. */
  unsynced: number;
  /** Other people with the page open, each once, in the order they arrived. */
  peers: readonly CollabUser[];
}

export interface CollabSession {
  doc: Doc;
  /** Null in local mode. */
  provider: HocuspocusProvider | null;
  getState(): CollabState;
  subscribe(listener: () => void): () => void;
  destroy(): void;
}

/** The close code the dev mock answers /collab with when no real server is behind it. */
export const NO_COLLAB_SERVER = 4404;

export interface CollabSessionOptions {
  pageId: string;
  /** wss://host/collab on the workspace origin. */
  url: string;
  user: CollabUser;
  /** Called once if the page falls back to a local document. */
  onLocal?: (doc: Doc) => void;
}

function peersOf(provider: HocuspocusProvider, me: CollabUser): CollabUser[] {
  const seen = new Map<string, CollabUser>();
  for (const [clientId, state] of provider.awareness?.getStates() ?? []) {
    if (clientId === provider.document.clientID) continue;
    const user = (state as { user?: CollabUser }).user;
    if (user?.id && user.id !== me.id && !seen.has(user.id)) seen.set(user.id, user);
  }
  return [...seen.values()];
}

/**
 * One page's Yjs document, kept in step with /collab by Hocuspocus. The document outlives
 * dropped connections: edits made offline stay in it and merge when the socket returns,
 * which the provider retries with backoff.
 */
export function createCollabSession(options: CollabSessionOptions): CollabSession {
  const doc = new Doc();
  const listeners = new Set<() => void>();
  let socket: 'connecting' | 'connected' | 'disconnected' = 'connecting';
  let synced = false;
  let readOnly = false;
  let denied = false;
  let local = false;
  let everSynced = false;
  let state: CollabState = { status: 'connecting', editable: false, unsynced: 0, peers: [] };

  const websocket = new HocuspocusProviderWebsocket({
    url: options.url,
    delay: 1_000,
    factor: 2,
    maxDelay: 30_000,
    maxAttempts: 0,
  });
  let provider: HocuspocusProvider | null = null;

  function statusNow(): CollabStatus {
    if (local) return 'local';
    if (denied) return 'denied';
    if (socket === 'connected' && synced) return readOnly ? 'read-only' : 'live';
    return socket === 'disconnected' ? 'offline' : 'connecting';
  }

  function update(): void {
    state = {
      status: statusNow(),
      editable: local || (!denied && !readOnly && everSynced),
      unsynced: provider?.unsyncedChanges ?? 0,
      peers: provider && !local ? peersOf(provider, options.user) : [],
    };
    for (const listener of listeners) listener();
  }

  function goLocal(): void {
    if (local) return;
    local = true;
    provider?.destroy();
    websocket.destroy();
    provider = null;
    options.onLocal?.(doc);
    update();
  }

  provider = new HocuspocusProvider({
    name: `docs.page:${options.pageId}`,
    document: doc,
    websocketProvider: websocket,
    onStatus: ({ status }) => {
      socket = status;
      if (status !== 'connected') synced = false;
      update();
    },
    onSynced: ({ state: isSynced }) => {
      synced = isSynced;
      everSynced ||= isSynced;
      update();
    },
    onAuthenticated: ({ scope }) => {
      readOnly = scope === 'readonly';
      denied = false;
      update();
    },
    onAuthenticationFailed: () => {
      denied = true;
      update();
    },
    onClose: ({ event }) => {
      if (event.code === NO_COLLAB_SERVER) goLocal();
    },
    onUnsyncedChanges: () => update(),
    onAwarenessChange: () => update(),
  });
  provider.attach();

  return {
    doc,
    get provider() {
      return provider;
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      listeners.clear();
      provider?.destroy();
      websocket.destroy();
      doc.destroy();
    },
  };
}
