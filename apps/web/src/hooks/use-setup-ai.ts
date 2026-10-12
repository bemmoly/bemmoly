import type { AiProvider } from '@bemmoly/shared';
import { queryKeys } from '@bemmoly/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { LOCAL_AI, NO_AI, useSetupStore, type AiChoice } from '../store/setup.ts';
import { useAiCatalog } from './use-ai-catalog.ts';
import { useAiRoles } from './use-ai-roles.ts';
import { aiSettingValues } from './use-ai-settings.ts';
import { aiAdminApi } from '../lib/ai-admin-api.ts';

/**
 * Step 5, AI: the same catalog, generated form, test and roles as Settings › AI, against the
 * same API. Nothing reaches a provider until Test connection or Connect; "Skip, no AI" and
 * "No AI for now" leave AI off.
 */
export function useSetupAi(onSaved: () => void | Promise<void>) {
  const client = useQueryClient();
  const choice = useSetupStore((state) => state.ai);
  const shareContent = useSetupStore((state) => state.shareContent);
  const allowActions = useSetupStore((state) => state.allowActions);
  const update = useSetupStore((state) => state.update);
  const [query, setQuery] = useState('');
  const catalog = useAiCatalog(query);
  const roles = useAiRoles();
  /** The provider connected on this visit to the step, per catalog choice. */
  const [connected, setConnected] = useState<Record<string, AiProvider>>({});
  // A provider connected on an earlier visit counts too, so coming back never connects twice.
  const stored = roles.providers.data?.items.find((row) =>
    choice === LOCAL_AI ? row.catalogId === 'custom' : row.catalogId === choice,
  );
  const provider = connected[choice] ?? stored ?? null;
  const save = useMutation({
    /** `row`: a provider the primary connected a moment ago, before state caught up. */
    mutationFn: async (row: AiProvider | null) => {
      const on = choice !== NO_AI && (row ?? provider) !== null;
      await Promise.all(
        Object.entries(
          aiSettingValues({ ai: on ? choice : NO_AI, shareContent, allowActions }),
        ).map(([key, value]) => api.settings.put(key as 'ai.providerId', value as string | null)),
      );
      await aiAdminApi.settings.update({ privacy: { enabled: on, shareContent, allowActions } });
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.settings.all() }),
        client.invalidateQueries({ queryKey: queryKeys.ai.all() }),
        client.invalidateQueries({ queryKey: queryKeys.me() }),
      ]);
      update({ aiSaved: true });
      await onSaved();
    },
  });
  const onConnected = async (row: AiProvider) => {
    setConnected((current) => ({ ...current, [choice]: row }));
    await roles.fillDefaults(row).catch(() => 0);
  };
  return {
    choice,
    pick: (next: AiChoice) => {
      setQuery('');
      update({ ai: next });
    },
    query,
    setQuery,
    catalog,
    selected: catalog.find(choice),
    isLocal: choice === LOCAL_AI,
    none: choice === NO_AI,
    provider,
    onConnected,
    roles,
    shareContent,
    setShareContent: (value: boolean) => update({ shareContent: value }),
    allowActions,
    setAllowActions: (value: boolean) => update({ allowActions: value }),
    save,
    /** Primary: save and move on; with a provider chosen it must be connected first. */
    canSave: choice === NO_AI || provider !== null,
    submit: (row: AiProvider | null = null) => save.mutate(row),
    skip: () => {
      update({ ai: NO_AI, aiSaved: false });
    },
  };
}

export type SetupAi = ReturnType<typeof useSetupAi>;
