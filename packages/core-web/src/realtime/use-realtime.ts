import type { RealtimeScope } from '@bemmoly/shared';
import { useEffect, useRef, useState } from 'react';
import { RealtimeClient, type RealtimeEvent, type RealtimeStatus } from './realtime-client.ts';

export interface UseRealtimeOptions {
  url: string;
  scopes: readonly RealtimeScope[];
  enabled: boolean;
  onEvent: (event: RealtimeEvent) => void;
}

/** Keeps one realtime connection open while enabled; reconnects with backoff. */
export function useRealtime({ url, scopes, enabled, onEvent }: UseRealtimeOptions): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('closed');
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  const scopeKey = JSON.stringify(scopes);
  useEffect(() => {
    if (!enabled) return;
    const client = new RealtimeClient({
      url,
      scopes: JSON.parse(scopeKey) as RealtimeScope[],
      onEvent: (event) => handler.current(event),
      onStatus: setStatus,
    });
    client.start();
    return () => client.stop();
  }, [url, scopeKey, enabled]);

  return enabled ? status : 'closed';
}
