import type { NotifyPayload, StreamEvent } from '../../../../shared/streams.ts';

/*
 * Fans NOTIFY payloads out to the server-sent event streams open on this replica, coalesced:
 * per topic and kind only the latest payload is kept, and a topic flushes at most once per
 * window (a second by default). The first event after a quiet spell goes out at once, so a
 * calm map still updates instantly; a merge storm costs each viewer one message per second.
 * Events are invalidations: a client that sees run.updated refetches the run, so dropping
 * the intermediate states loses nothing.
 */

export interface StreamSubscriber {
  topics: readonly string[];
  /** The person behind the stream; per-person topics (for-you) reach only them. */
  userId: string | null;
  send(event: StreamEvent): void;
}

export interface StreamHubOptions {
  /** Starts listening; resolves to a function that stops. Called on the first subscriber. */
  listen?: (onPayload: (payload: NotifyPayload) => void) => Promise<() => Promise<void>>;
  coalesceMs?: number;
  now?: () => number;
}

interface TopicState {
  subscribers: Set<StreamSubscriber>;
  pending: Map<string, NotifyPayload>;
  timer: ReturnType<typeof setTimeout> | null;
  lastFlush: number;
}

const PER_PERSON = new Set(['for-you']);

interface LogAppend {
  jobId: string;
  fromLine: number;
  lines: Array<{ number: number }>;
  toLine?: number;
}

/**
 * Log lines are not invalidations: keeping only the latest append would drop lines. Two
 * appends in one window join when the second continues the first; otherwise the merged
 * event keeps the earliest start and the latest end with no lines, and the client reads the
 * range (logs.ts says so).
 */
export function mergeLogAppends(first: NotifyPayload, second: NotifyPayload): NotifyPayload {
  const a = first.data as LogAppend | undefined;
  const b = second.data as LogAppend | undefined;
  if (!a || !b) return { ...second, data: undefined };
  const aEnd = a.fromLine + a.lines.length;
  const toLine = Math.max(a.toLine ?? aEnd - 1, b.toLine ?? b.fromLine + b.lines.length - 1);
  const contiguous = (a.toLine ?? aEnd - 1) === aEnd - 1 && b.fromLine === aEnd;
  const lines =
    contiguous && a.lines.length + b.lines.length <= 2000 ? [...a.lines, ...b.lines] : [];
  return {
    ...second,
    data: { jobId: b.jobId, fromLine: Math.min(a.fromLine, b.fromLine), lines, toLine },
  };
}

export function createStreamHub(options: StreamHubOptions = {}) {
  const coalesceMs = options.coalesceMs ?? 1000;
  const now = options.now ?? Date.now;
  const topics = new Map<string, TopicState>();
  let stopListening: Promise<() => Promise<void>> | null = null;

  function flush(topic: string, state: TopicState) {
    state.timer = null;
    state.lastFlush = now();
    const at = new Date(state.lastFlush).toISOString();
    for (const payload of state.pending.values()) {
      const event = { topic, kind: payload.kind, at, data: payload.data ?? {} } as StreamEvent;
      for (const subscriber of state.subscribers) {
        if (PER_PERSON.has(topic) && payload.userId && payload.userId !== subscriber.userId) {
          continue;
        }
        subscriber.send(event);
      }
    }
    state.pending.clear();
  }

  function dispatch(payload: NotifyPayload) {
    const state = topics.get(payload.topic);
    if (!state || state.subscribers.size === 0) return;
    const previous = state.pending.get(payload.kind);
    state.pending.set(
      payload.kind,
      payload.kind === 'log.appended' && previous ? mergeLogAppends(previous, payload) : payload,
    );
    if (state.timer) return;
    const wait = Math.max(0, state.lastFlush + coalesceMs - now());
    state.timer = setTimeout(() => flush(payload.topic, state), wait);
  }

  return {
    dispatch,

    /** Adds a stream; returns the function that removes it. */
    subscribe(subscriber: StreamSubscriber): () => void {
      if (!stopListening && options.listen) stopListening = options.listen(dispatch);
      for (const topic of subscriber.topics) {
        let state = topics.get(topic);
        if (!state) {
          state = { subscribers: new Set(), pending: new Map(), timer: null, lastFlush: 0 };
          topics.set(topic, state);
        }
        state.subscribers.add(subscriber);
      }
      return () => {
        for (const topic of subscriber.topics) {
          const state = topics.get(topic);
          if (!state) continue;
          state.subscribers.delete(subscriber);
          if (state.subscribers.size > 0) continue;
          if (state.timer) clearTimeout(state.timer);
          topics.delete(topic);
        }
      };
    },

    /** Streams open on this replica, for metrics and tests. */
    size: () => new Set([...topics.values()].flatMap((state) => [...state.subscribers])).size,

    async stop() {
      for (const state of topics.values()) if (state.timer) clearTimeout(state.timer);
      topics.clear();
      const stop = stopListening;
      stopListening = null;
      if (stop) await (await stop)();
    },
  };
}

export type StreamHub = ReturnType<typeof createStreamHub>;
