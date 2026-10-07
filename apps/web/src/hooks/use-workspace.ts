import { hasErrorCode, queryKeys } from '@bemmoly/api-client';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import {
  APPEARANCE_KEYS,
  appearanceFrom,
  DEFAULT_APPEARANCE,
  type Appearance,
} from '../lib/appearance.ts';

export interface WorkspaceLook {
  name: string;
  appearance: Appearance;
  /** An AI provider is chosen: the top bar shows "Ask Bemmoly". */
  aiEnabled: boolean;
}

const KEYS = ['workspace.name', 'ai.providerId', ...APPEARANCE_KEYS] as const;

const FALLBACK: WorkspaceLook = {
  name: 'Bemmoly',
  appearance: DEFAULT_APPEARANCE,
  aiEnabled: false,
};

/**
 * The workspace name and look for everyone signed in. Settings are read
 * through the admin API, so people without settings access see the defaults
 * rather than a failing shell; a public appearance read is an open request.
 */
export const workspaceQuery = queryOptions({
  queryKey: queryKeys.settings.many(KEYS),
  queryFn: async (): Promise<WorkspaceLook> => {
    try {
      const reads = await api.settings.getMany(KEYS);
      return {
        name: reads['workspace.name'].value ?? FALLBACK.name,
        appearance: appearanceFrom(reads),
        aiEnabled: Boolean(reads['ai.providerId'].value),
      };
    } catch (error) {
      if (hasErrorCode(error, 'forbidden')) return FALLBACK;
      throw error;
    }
  },
  staleTime: 5 * 60_000,
});

export function useWorkspace(): WorkspaceLook {
  const { data } = useQuery(workspaceQuery);
  return data ?? FALLBACK;
}
