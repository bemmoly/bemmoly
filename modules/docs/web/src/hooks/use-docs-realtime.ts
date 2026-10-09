import { useRealtime, type RealtimeEvent } from '@bemmoly/core-web';
import type { RealtimeScope } from '@bemmoly/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { realtimeUrl } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';

/**
 * Subscribes to a space's realtime scope while a Docs screen shows it and
 * invalidates the Docs queries on every docs.* event. Events carry ids only;
 * the data comes back through the REST API.
 */
export function useDocsRealtime(spaceId: string | undefined) {
  const queryClient = useQueryClient();
  const onEvent = useCallback(
    (event: RealtimeEvent) => {
      if (!event.kind.startsWith('docs.')) return;
      void queryClient.invalidateQueries({ queryKey: docsKeys.all() });
    },
    [queryClient],
  );
  const scopes: RealtimeScope[] = spaceId ? [{ kind: 'space', id: spaceId }] : [];
  return useRealtime({ url: realtimeUrl(), scopes, enabled: Boolean(spaceId), onEvent });
}
