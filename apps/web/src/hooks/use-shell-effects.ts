import { keysForEvent } from '@bemmoly/api-client';
import type { RealtimeScope } from '@bemmoly/shared';
import { useRealtime, type RealtimeEvent } from '@bemmoly/core-web';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { realtimeUrl } from '../lib/api.ts';

/** Workspace-wide changes, plus anything addressed to this person (the hub delivers those unasked). */
const WORKSPACE: RealtimeScope[] = [{ kind: 'workspace' }];

/** One socket per tab for the signed-in person; events invalidate the matching queries. */
export function useRealtimeSync(enabled: boolean) {
  const queryClient = useQueryClient();
  const onEvent = useCallback(
    (event: RealtimeEvent) => {
      for (const queryKey of keysForEvent(event.kind))
        void queryClient.invalidateQueries({ queryKey });
    },
    [queryClient],
  );
  return useRealtime({ url: realtimeUrl(), scopes: WORKSPACE, enabled, onEvent });
}
