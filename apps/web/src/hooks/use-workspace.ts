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
}

const KEYS = ['workspace.name', ...APPEARANCE_KEYS] as const;

/**
 * The workspace name and look for everyone signed in. A key the server does
 * not share with this person reads as the default rather than failing the shell.
 */
export const workspaceQuery = queryOptions({
  queryKey: queryKeys.settings.many(KEYS),
  queryFn: async (): Promise<WorkspaceLook> => {
    try {
      const reads = await api.settings.getMany(KEYS);
      return {
        name: reads['workspace.name'].value ?? 'Bemmoly',
        appearance: appearanceFrom(reads),
      };
    } catch (error) {
      if (hasErrorCode(error, 'forbidden'))
        return { name: 'Bemmoly', appearance: DEFAULT_APPEARANCE };
      throw error;
    }
  },
  staleTime: 5 * 60_000,
});

export function useWorkspace(): WorkspaceLook {
  const { data } = useQuery(workspaceQuery);
  return data ?? { name: 'Bemmoly', appearance: DEFAULT_APPEARANCE };
}
