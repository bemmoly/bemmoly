export interface CollabLimits {
  /** Largest single WebSocket message accepted, in bytes; bigger ones close the socket. */
  maxMessageBytes: number;
  /**
   * Document messages (edits, sync, auth) one connection may send per window before it is
   * closed. Awareness (carets, selections, who is here) has a budget of its own,
   * AWARENESS_FACTOR times this, so moving the caret never spends the typing budget.
   */
  messagesPerWindow: number;
  windowMs: number;
}

/**
 * 2 MiB holds a large paste (images are URLs, never bytes, in a document). 1200 document
 * messages per 10 seconds is twice the fastest key repeat (about 60 keys a second, one edit
 * each), measured in a browser; a person typing fast sends a third of it. Before awareness
 * had its own budget, holding a key down with the caret moving closed the socket at 600.
 */
export const DEFAULT_COLLAB_LIMITS: CollabLimits = {
  maxMessageBytes: 2 * 1024 * 1024,
  messagesPerWindow: 1200,
  windowMs: 10_000,
};

/**
 * Awareness messages allowed per window, as a multiple of messagesPerWindow. Every caret move
 * and every step of a mouse selection sends one, up to the display's frame rate; three times
 * the document budget is far past what a person makes and still stops a flood.
 */
export const AWARENESS_FACTOR = 3;

/** WebSocket close codes the host uses; 1009 and 1008 are the standard ones for these. */
export const CLOSE_TOO_BIG = { code: 1009, reason: 'message too big' } as const;
export const CLOSE_RATE_LIMITED = { code: 1008, reason: 'rate limited' } as const;

export type LimitVerdict = 'ok' | 'too-big' | 'rate-limited';
export type MessageKind = 'document' | 'awareness';

/** The Hocuspocus message type for awareness updates. */
const AWARENESS = 1;

/** A lib0 variable-length unsigned integer at `offset`, or null past the end. */
function readVarUint(bytes: Uint8Array, offset: number): { value: number; next: number } | null {
  let value = 0;
  let shift = 0;
  for (let at = offset; at < bytes.length && shift < 35; at += 1) {
    const byte = bytes[at]!;
    value += (byte & 0x7f) * 2 ** shift;
    if (byte < 0x80) return { value, next: at + 1 };
    shift += 7;
  }
  return null;
}

/**
 * Which budget a message spends: a Hocuspocus message is the document name (a lib0 string:
 * length, then UTF-8 bytes) and then its type. Anything that does not parse counts as a
 * document message, the stricter budget.
 */
export function messageKindOf(bytes: Uint8Array): MessageKind {
  const name = readVarUint(bytes, 0);
  if (!name) return 'document';
  const type = readVarUint(bytes, name.next + name.value);
  return type?.value === AWARENESS ? 'awareness' : 'document';
}

/**
 * One connection's budgets: fixed window counters, one for document messages and one for
 * awareness. Kept in memory on purpose; a socket lives on one process, so there is nothing
 * to share across replicas, unlike the HTTP limits.
 */
export function createMessageLimiter(limits: CollabLimits, now: () => number = Date.now) {
  let windowStart = now();
  const sent: Record<MessageKind, number> = { document: 0, awareness: 0 };
  const budget: Record<MessageKind, number> = {
    document: limits.messagesPerWindow,
    awareness: limits.messagesPerWindow * AWARENESS_FACTOR,
  };
  return {
    check(byteLength: number, kind: MessageKind = 'document'): LimitVerdict {
      if (byteLength > limits.maxMessageBytes) return 'too-big';
      const at = now();
      if (at - windowStart >= limits.windowMs) {
        windowStart = at;
        sent.document = 0;
        sent.awareness = 0;
      }
      sent[kind] += 1;
      return sent[kind] > budget[kind] ? 'rate-limited' : 'ok';
    },
  };
}
