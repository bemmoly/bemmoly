export interface CollabLimits {
  /** Largest single WebSocket message accepted, in bytes; bigger ones close the socket. */
  maxMessageBytes: number;
  /** Messages one connection may send per window before it is closed. */
  messagesPerWindow: number;
  windowMs: number;
}

/**
 * 2 MiB holds a large paste (images are URLs, never bytes, in a document); 600 messages per
 * 10 seconds is several people's worth of fast typing plus awareness on one socket.
 */
export const DEFAULT_COLLAB_LIMITS: CollabLimits = {
  maxMessageBytes: 2 * 1024 * 1024,
  messagesPerWindow: 600,
  windowMs: 10_000,
};

/** WebSocket close codes the host uses; 1009 and 1008 are the standard ones for these. */
export const CLOSE_TOO_BIG = { code: 1009, reason: 'message too big' } as const;
export const CLOSE_RATE_LIMITED = { code: 1008, reason: 'rate limited' } as const;

export type LimitVerdict = 'ok' | 'too-big' | 'rate-limited';

/**
 * One connection's budget: a fixed window counter. Kept in memory on purpose; a socket lives
 * on one process, so there is nothing to share across replicas, unlike the HTTP limits.
 */
export function createMessageLimiter(limits: CollabLimits, now: () => number = Date.now) {
  let windowStart = now();
  let count = 0;
  return {
    check(byteLength: number): LimitVerdict {
      if (byteLength > limits.maxMessageBytes) return 'too-big';
      const at = now();
      if (at - windowStart >= limits.windowMs) {
        windowStart = at;
        count = 0;
      }
      count += 1;
      return count > limits.messagesPerWindow ? 'rate-limited' : 'ok';
    },
  };
}
