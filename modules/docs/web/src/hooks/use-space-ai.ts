import { queryKeys } from '@bemmoly/api-client';
import { useQuery } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { useSession } from '../shared/people.ts';
import { useSpace } from './queries.ts';

/** This person's AI status: on or off, opted out, ghost text and what Privacy excludes. */
export function useAiStatus(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.ai.status(),
    queryFn: () => api.ai.status(),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Whether AI may work on pages in this space for this person: AI on and not opted out, and
 * the space excluded neither by its own switch nor by Settings › AI › Privacy. False while
 * the space is still loading, so no AI action flashes in and then out.
 */
export function useSpaceAi(spaceKey: string | undefined): boolean {
  const { aiEnabled } = useSession();
  const space = useSpace(aiEnabled ? spaceKey : undefined);
  const status = useAiStatus(aiEnabled);
  return (
    aiEnabled &&
    space.data?.aiExcluded === false &&
    status.data?.enabled !== false &&
    status.data?.optedOut !== true &&
    !status.data?.excludedSpaceIds.includes(space.data.id)
  );
}
