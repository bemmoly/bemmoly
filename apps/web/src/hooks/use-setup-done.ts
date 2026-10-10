import { queryKeys } from '@bemmoly/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { api } from '../lib/api.ts';
import { draftOf, useSetupStore, type SetupDraft } from '../store/setup.ts';
import { BUNDLED_CATALOG, providerFor } from './use-ai-catalog.ts';
import { aiSummary, providerIdOf } from './use-ai-settings.ts';
import { useModule } from './use-modules.ts';
import { meQuery } from './use-session.ts';
import { settingsQuery } from './use-setting.ts';
import { themeSummary } from './use-setup-appearance.ts';
import { importSummary } from './use-setup-import.ts';

export interface SummaryRow {
  key: 'workspace' | 'admin' | 'import' | 'signIn' | 'ai' | 'theme';
  label: string;
  value: string;
  /** False when the step was skipped, so the row is not ticked as if it were set. */
  done: boolean;
  /** Where to finish a skipped step later: a Settings page, opened from the summary. */
  later?: { label: string; to: string };
}

export const DONE_ACTIONS = {
  open: { label: 'Open Bemmoly', to: '/' },
  invite: { label: 'Invite people', to: '/settings/users' },
  project: { label: 'Create your first project', to: '/work/projects/new' },
  modules: { label: 'Turn on Work', to: '/settings/modules' },
} as const;

const DO_IT_NOW = 'Do it now';

const WORKSPACE_KEYS = ['workspace.name', 'workspace.url'] as const;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function invitesLine(count: number): string {
  if (count === 0) return 'no invites sent';
  return count === 1 ? '1 invite sent' : `${count} invites sent`;
}

/** The Done step's rows, from what was saved rather than what the mock shows. */
export function summaryRows(input: {
  workspaceName: string;
  workspaceUrl: string;
  adminEmail: string;
  draft: SetupDraft;
  providerName: string | null;
}): SummaryRow[] {
  const { draft } = input;
  const workspace = [input.workspaceName, input.workspaceUrl && hostOf(input.workspaceUrl)];
  return [
    {
      key: 'workspace',
      label: 'Workspace',
      value: workspace.filter(Boolean).join(' · '),
      done: true,
    },
    {
      key: 'admin',
      label: 'Admin',
      value: `${input.adminEmail} (break-glass password set)`,
      done: true,
    },
    {
      key: 'import',
      label: 'Import',
      value: importSummary(draft.importSource),
      done: draft.importSource !== null,
    },
    {
      key: 'signIn',
      label: 'Sign-in',
      value: `Password · ${invitesLine(draft.invitesSent)}`,
      done: true,
      ...(draft.invitesSent === 0 ? { later: { label: 'Invite people', to: '/settings/users' } } : {}),
    },
    {
      key: 'ai',
      label: 'AI',
      value: draft.aiSaved
        ? aiSummary(input.providerName, draft)
        : 'Skipped · connect a provider any time in Settings',
      done: draft.aiSaved,
      ...(draft.aiSaved ? {} : { later: { label: DO_IT_NOW, to: '/settings/ai' } }),
    },
    {
      key: 'theme',
      label: 'Theme',
      value: themeSummary(
        draft.theme,
        draft.themeSaved,
        draft.useCustomTheme ? draft.customTheme : null,
      ),
      done: draft.themeSaved,
      ...(draft.themeSaved ? {} : { later: { label: DO_IT_NOW, to: '/settings/appearance' } }),
    },
  ];
}

/**
 * Writes setup.completedAt. The router guard reads it from the setup status,
 * so that entry is dropped to make the next navigation read the new value.
 */
export function useCompleteSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.settings.put('setup.completedAt', new Date().toISOString()),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: queryKeys.setupStatus() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.all() });
    },
  });
}

/** The summary: marks setup finished once on arrival and lists what happened. */
export function useSetupDone() {
  const draft = useSetupStore(useShallow(draftOf));
  const reset = useSetupStore((state) => state.reset);
  const workspace = useQuery(settingsQuery(WORKSPACE_KEYS));
  const me = useQuery(meQuery);
  const work = useModule('work');
  const complete = useCompleteSetup();
  const started = useRef(false);
  const { mutate } = complete;
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutate();
  }, [mutate]);

  const rows = summaryRows({
    workspaceName: workspace.data?.['workspace.name'].value ?? '',
    workspaceUrl: workspace.data?.['workspace.url'].value ?? '',
    adminEmail: me.data?.user.email ?? '',
    draft,
    providerName: providerFor(BUNDLED_CATALOG, providerIdOf(draft.ai))?.name ?? null,
  });
  return {
    rows,
    loading: workspace.isPending || me.isPending,
    complete,
    retry: () => complete.mutate(),
    actions: DONE_ACTIONS,
    /** With Work off there is nowhere to create a project yet, so the card turns it on. */
    projectAction: work.manifest ? DONE_ACTIONS.project : DONE_ACTIONS.modules,
    /** Clears the wizard's draft when the admin leaves the summary. */
    leave: reset,
  };
}
