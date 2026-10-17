import { streamEventSchema, type StreamEvent } from '@bemmoly/module-pipelines/shared';

/*
 * One server-sent events stream per tab (architecture §18). Screens subscribe to topics; the
 * stream reopens with the union of everyone's topics a moment after the set changes, so
 * opening a run and its log costs one reconnect, not two. EventSource reconnects by itself
 * after a drop (the server asks for 3 seconds), sending the session cookie each time.
 */

type Listener = (event: StreamEvent) => void;

export interface StreamOptions {
  url: (topics: readonly string[]) => string;
  /** Tests pass a fake; the browser's EventSource otherwise. */
  create?: (url: string) => EventSource;
  /** How long to gather topic changes before reopening. */
  settleMs?: number;
}

export function createStream(options: StreamOptions) {
  const counts = new Map<string, number>();
  const listeners = new Map<string, Set<Listener>>();
  let source: EventSource | null = null;
  let openTopics = '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  function deliver(text: string) {
    const parsed = streamEventSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return;
    for (const listener of listeners.get(parsed.data.topic) ?? []) listener(parsed.data);
  }

  function reopen() {
    timer = null;
    const topics = [...counts.keys()].sort();
    const key = topics.join(',');
    if (key === openTopics) return;
    source?.close();
    source = null;
    openTopics = key;
    if (topics.length === 0) return;
    const create = options.create ?? ((url: string) => new EventSource(url));
    const next = create(options.url(topics));
    next.onmessage = (message) => deliver(String(message.data));
    // Named events (event: run.updated) arrive as their own type; listen to the ones we send.
    for (const kind of KINDS)
      next.addEventListener(kind, (message) => deliver(String((message as MessageEvent).data)));
    source = next;
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(reopen, options.settleMs ?? 50);
  }

  return {
    subscribe(topics: readonly string[], listener: Listener): () => void {
      for (const topic of topics) {
        counts.set(topic, (counts.get(topic) ?? 0) + 1);
        let set = listeners.get(topic);
        if (!set) {
          set = new Set();
          listeners.set(topic, set);
        }
        set.add(listener);
      }
      schedule();
      return () => {
        for (const topic of topics) {
          const left = (counts.get(topic) ?? 1) - 1;
          if (left <= 0) counts.delete(topic);
          else counts.set(topic, left);
          listeners.get(topic)?.delete(listener);
        }
        schedule();
      };
    },
    close() {
      if (timer) clearTimeout(timer);
      source?.close();
      source = null;
      openTopics = '';
    },
  };
}

const KINDS = [
  'counter',
  'run.updated',
  'job.updated',
  'log.appended',
  'map.cell',
  'current.updated',
  'promotion.updated',
  'deployment.updated',
  'for-you.changed',
  'capacity.updated',
] as const;

export type Stream = ReturnType<typeof createStream>;
