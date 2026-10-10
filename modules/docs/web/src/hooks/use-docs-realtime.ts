import { useRealtime, type RealtimeEvent } from '@bemmoly/core-web';
import type { RealtimeScope } from '@bemmoly/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { realtimeUrl } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';

/**
 * Subscribes to the realtime scopes of the spaces a Docs screen shows (one for a space,
 * every visible one for the home) and invalidates the Docs queries on each docs.* event,
 * so a second tab follows a move, a rename or a new page. Events carry ids only; the data
 * comes back through the REST API.
 */
export function useDocsRealtime(spaceIds: readonly string[]) {
  const queryClient = useQueryClient();
  const onEvent = useCallback(
    (event: RealtimeEvent) => {
      if (!event.kind.startsWith('docs.')) return;
      void queryClient.invalidateQueries({ queryKey: docsKeys.all() });
    },
    [queryClient],
  );
  const signature = spaceIds.join(',');
  const scopes = useMemo<RealtimeScope[]>(
    () => (signature ? signature.split(',').map((id) => ({ kind: 'space', id })) : []),
    [signature],
  );
  return useRealtime({ url: realtimeUrl(), scopes, enabled: scopes.length > 0, onEvent });
}
