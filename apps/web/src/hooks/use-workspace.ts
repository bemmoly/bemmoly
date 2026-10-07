import { queryKeys } from '@bemmoly/api-client';
import { themeFontSchema, type MeResponse } from '@bemmoly/shared';
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

/** The look /me carries, in the shape the theme and the appearance page share. */
export function workspaceLookOf(workspace: MeResponse['workspace']): WorkspaceLook {
  const { appearance } = workspace;
  return {
    name: workspace.name,
    aiEnabled: workspace.aiEnabled,
    appearance: appearanceFrom({
      'appearance.theme': { value: appearance.theme },
      'appearance.brandColor': { value: appearance.brandColor },
      'appearance.font': { value: themeFontSchema.safeParse(appearance.font).data },
      'appearance.logoKey': { value: appearance.logoKey || undefined },
      'appearance.mode': { value: appearance.mode },
      'appearance.surfaces': { value: appearance.surfaces },
      'appearance.memberModeSwitch': { value: appearance.memberModeSwitch },
      'appearance.personalThemes': { value: appearance.personalThemes },
    }),
  };
}

/**
 * The workspace name and look for everyone signed in, from /me, which carries
 * them whatever the person's capabilities. Keyed with the settings it is built
 * from, so saving any of them (Appearance, the wizard) refreshes the look.
 */
export const workspaceQuery = queryOptions({
  queryKey: queryKeys.settings.many(KEYS),
  queryFn: async (): Promise<WorkspaceLook> => workspaceLookOf((await api.auth.me()).workspace),
  staleTime: 5 * 60_000,
});

export function useWorkspace(): WorkspaceLook {
  const { data } = useQuery(workspaceQuery);
  return data ?? FALLBACK;
}
