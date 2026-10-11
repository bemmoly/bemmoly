import type { PresenceEntry, RealtimeScope } from '@bemmoly/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RealtimeClient, type PresencePlace } from './realtime-client.ts';

/** A tab left in the background this long stops counting as here, until it is looked at. */
export const AWAY_AFTER_MS = 3 * 60_000;

export interface UseRealtimePresenceOptions {
  url: string;
  /** The scope to be present in; null (still loading, or nowhere) joins nothing. */
  scope: RealtimeScope | null;
  /** Where in it: "board", "backlog", "issue:PLT-204". */
  view: string | null;
}

/** Here unless the tab has been hidden for a while. */
function useLooking(): boolean {
  const [looking, setLooking] = useState(true);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      if (document.visibilityState === 'visible') setLooking(true);
      else timer = setTimeout(() => setLooking(false), AWAY_AFTER_MS);
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return looking;
}

/**
 * The other people on the same view of a scope, earliest arrival first; never the signed-in
 * person, whose own tabs the server leaves out. Opens one presence socket while a scope is
 * given, moves within it as the view changes without reconnecting, rejoins after a reconnect,
 * and shows nobody while the socket is down rather than faces that may have gone.
 */
export function useRealtimePresence({
  url,
  scope,
  view,
}: UseRealtimePresenceOptions): PresenceEntry[] {
  const [people, setPeople] = useState<PresenceEntry[]>([]);
  const client = useRef<RealtimeClient | null>(null);
  const looking = useLooking();
  const scopeKey = scope ? JSON.stringify(scope) : '';
  const place: PresencePlace | null =
    scopeKey && view && looking ? { scope: JSON.parse(scopeKey) as RealtimeScope, view } : null;
  const placeKey = place ? JSON.stringify(place) : '';
  const latest = useRef(place);
  useEffect(() => {
    latest.current = place;
  });

  useEffect(() => {
    if (!scopeKey) return undefined;
    const next = new RealtimeClient({
      url,
      scopes: [],
      presence: latest.current,
      onEvent: () => undefined,
      onPresence: setPeople,
      onStatus: (status) => {
        if (status !== 'open') setPeople([]);
      },
    });
    client.current = next;
    next.start();
    return () => {
      next.stop();
      client.current = null;
    };
  }, [url, scopeKey]);

  useEffect(() => {
    client.current?.present(placeKey ? (JSON.parse(placeKey) as PresencePlace) : null);
  }, [placeKey]);

  return useMemo(
    () => (placeKey ? people.filter((person) => person.view === view) : []),
    [people, placeKey, view],
  );
}
