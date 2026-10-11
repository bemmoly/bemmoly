import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { WebSocket } from 'ws';
import { Doc } from 'yjs';

export interface CollabTestClientOptions {
  /** ws://host:port/collab */
  url: string;
  /** `<kind>:<id>` */
  name: string;
  /** Cookie and Origin, as a browser on the workspace origin would send them. */
  headers: Record<string, string>;
  doc?: Doc;
}

export interface CollabTestClient {
  provider: HocuspocusProvider;
  doc: Doc;
  /** Resolves with the scope the server granted: "read-write" or "readonly". */
  authenticated: Promise<string>;
  /** Resolves with the reason when the server refuses the document. */
  refused: Promise<string>;
  /** Resolves when the first sync with the server completes. */
  synced: Promise<void>;
  /** Resolves with the close code of the socket. */
  closed: Promise<number>;
  destroy(): void;
}

/**
 * A HocuspocusProvider for Node tests: `ws` carries the session cookie and Origin header a
 * browser would send, and it does not reconnect, so a refused socket stays refused.
 */
export function connectCollabClient(options: CollabTestClientOptions): CollabTestClient {
  const { headers } = options;
  class HeaderSocket extends WebSocket {
    constructor(address: string, protocols?: string | string[]) {
      super(address, protocols, { headers });
    }
  }
  const doc = options.doc ?? new Doc();
  let onAuthenticated: (scope: string) => void = () => undefined;
  let onRefused: (reason: string) => void = () => undefined;
  let onSynced: () => void = () => undefined;
  let onClosed: (code: number) => void = () => undefined;
  const authenticated = new Promise<string>((resolve) => (onAuthenticated = resolve));
  const refused = new Promise<string>((resolve) => (onRefused = resolve));
  const synced = new Promise<void>((resolve) => (onSynced = resolve));
  const closed = new Promise<number>((resolve) => (onClosed = resolve));
  const websocketProvider = new HocuspocusProviderWebsocket({
    url: options.url,
    WebSocketPolyfill: HeaderSocket,
    maxAttempts: 1,
    onClose: ({ event }) => onClosed(event.code),
  });
  const provider = new HocuspocusProvider({
    name: options.name,
    document: doc,
    websocketProvider,
    onAuthenticated: ({ scope }) => onAuthenticated(scope),
    onAuthenticationFailed: ({ reason }) => onRefused(reason),
    onSynced: ({ state }) => {
      if (state) onSynced();
    },
  });
  provider.attach();
  return {
    provider,
    doc,
    authenticated,
    refused,
    synced,
    closed,
    destroy() {
      provider.destroy();
      websocketProvider.destroy();
    },
  };
}

/** Polls until the check passes, for state that arrives over a socket. */
export async function eventually(check: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for the condition');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
