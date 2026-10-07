import { useEffect, useRef, useState } from 'react';
import { RealtimeClient, type RealtimeEvent, type RealtimeStatus } from './realtime-client.ts';

export interface UseRealtimeOptions {
  url: string;
  scopes: readonly string[];
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

  const scopeKey = scopes.join('\n');
  useEffect(() => {
    if (!enabled) return;
    const client = new RealtimeClient({
      url,
      scopes: scopeKey.split('\n').filter(Boolean),
      onEvent: (event) => handler.current(event),
      onStatus: setStatus,
    });
    client.start();
    return () => client.stop();
  }, [url, scopeKey, enabled]);

  return enabled ? status : 'closed';
}
