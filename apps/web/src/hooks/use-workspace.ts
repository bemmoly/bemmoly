import { queryKeys } from '@bemmoly/api-client';
import type { MeResponse } from '@bemmoly/shared';
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
  /**
   * AI is on for this person: the workspace has it on with a model to call, and they have not
   * turned it off for themselves. Every AI surface renders only while it is true (ai.md); hosts
   * pass it to modules. The server decides it; turning AI on or off, an opt-out and the
   * realtime "ai" event all refetch it, so it follows a flip live.
   */
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
    appearance: appearanceFrom(
      {
        'appearance.theme': { value: appearance.theme },
        'appearance.customThemeId': { value: appearance.customThemeId },
        'appearance.defaultMode': { value: appearance.defaultMode },
        'appearance.font': { value: appearance.font },
        'appearance.logoKey': { value: appearance.logoKey || undefined },
      },
      appearance.customThemes,
    ),
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
