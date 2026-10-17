import type { LiveCounter, StreamEvent } from '@bemmoly/module-pipelines/shared';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import { createStream } from '../lib/stream.ts';

/** The tab's one stream, shared by every screen. */
export const stream = createStream({ url: (topics) => api.pipelines.streamUrl(topics) });

/** Calls `onEvent` for each event on these topics while the component is mounted. */
export function useStream(topics: readonly string[], onEvent: (event: StreamEvent) => void): void {
  const handler = useRef(onEvent);
  useLayoutEffect(() => {
    handler.current = onEvent;
  });
  const key = topics.join(',');
  useEffect(() => {
    if (!key) return undefined;
    return stream.subscribe(key.split(','), (event) => handler.current(event));
  }, [key]);
}

/** The top bar's "214 running · 38 queued", live; null until the first value arrives. */
export function useLiveCounter(initial: LiveCounter | undefined): LiveCounter | null {
  const [live, setLive] = useState<LiveCounter | null>(null);
  useStream(['live'], (event) => {
    if (event.kind === 'counter') setLive(event.data);
  });
  return live ?? initial ?? null;
}
