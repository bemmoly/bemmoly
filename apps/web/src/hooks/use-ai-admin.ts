import { queryKeys } from '@bemmoly/api-client';
import type { AiPrivacy, AiSettingsResponse, AiSettingsUpdateBody } from '@bemmoly/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { describeError } from '../lib/errors.ts';
import { toast, undoToast } from '../lib/toast.ts';
import { useMe } from './use-session.ts';
import { aiAdminApi } from '../lib/ai-admin-api.ts';

export const CONFIGURE_AI = 'ai.models.configure';

export const aiSettingsQuery = queryOptions({
  queryKey: queryKeys.ai.settings(),
  queryFn: () => aiAdminApi.settings.get(),
});

export const aiProvidersQuery = queryOptions({
  queryKey: queryKeys.ai.providers(),
  queryFn: () => aiAdminApi.providers.list(),
});

export const aiRolesQuery = queryOptions({
  queryKey: queryKeys.ai.roles(),
  queryFn: () => aiAdminApi.roles.list(),
});

/** Merges a change into the cached settings, the way the server will. */
export function applyUpdate(
  settings: AiSettingsResponse,
  body: AiSettingsUpdateBody,
): AiSettingsResponse {
  return {
    ...settings,
    privacy: { ...settings.privacy, ...body.privacy },
    budget: body.budget ?? settings.budget,
    liveCatalog: body.liveCatalog ?? settings.liveCatalog,
  };
}

/** The settings change that puts back what a change replaced. */
export function inverseOf(
  settings: AiSettingsResponse,
  body: AiSettingsUpdateBody,
): AiSettingsUpdateBody {
  const privacy = body.privacy
    ? (Object.fromEntries(
        Object.keys(body.privacy).map((key) => [key, settings.privacy[key as keyof AiPrivacy]]),
      ) as Partial<AiPrivacy>)
    : undefined;
  return {
    ...(privacy ? { privacy } : {}),
    ...(body.budget ? { budget: settings.budget } : {}),
    ...(body.liveCatalog === undefined ? {} : { liveCatalog: settings.liveCatalog }),
  };
}

interface ChangeOptions {
  /** The toast after the change lands; with Undo unless `undo` is false. */
  title: string;
  undo?: boolean;
}

/**
 * Settings › AI's settings: read once, changed in place. A change shows at once, rolls back
 * with a toast if the server refuses it, and offers Undo for six seconds. Turning AI on or off
 * also refreshes /me, so every AI surface follows.
 */
export function useAiAdminSettings() {
  const client = useQueryClient();
  const me = useMe();
  const canConfigure = me.can(CONFIGURE_AI);
  const query = useQuery({ ...aiSettingsQuery, enabled: canConfigure });
  const mutation = useMutation({
    mutationFn: (body: AiSettingsUpdateBody) => aiAdminApi.settings.update(body),
    onMutate: async (body) => {
      await client.cancelQueries({ queryKey: queryKeys.ai.settings() });
      const before = client.getQueryData<AiSettingsResponse>(queryKeys.ai.settings());
      if (before) client.setQueryData(queryKeys.ai.settings(), applyUpdate(before, body));
      return { before };
    },
    onError: (error, _body, context) => {
      if (context?.before) client.setQueryData(queryKeys.ai.settings(), context.before);
      toast(describeError(error).message, 'danger');
    },
    onSuccess: (settings) => client.setQueryData(queryKeys.ai.settings(), settings),
    onSettled: async (_data, _error, body) => {
      if (body.privacy?.enabled !== undefined || body.privacy?.perUserOptOutAllowed !== undefined) {
        await Promise.all([
          client.invalidateQueries({ queryKey: queryKeys.me() }),
          client.invalidateQueries({ queryKey: queryKeys.settings.all() }),
          client.invalidateQueries({ queryKey: queryKeys.ai.status() }),
        ]);
      }
      if (body.budget) await client.invalidateQueries({ queryKey: ['ai', 'usage'] });
      if (body.liveCatalog !== undefined) {
        await client.invalidateQueries({ queryKey: queryKeys.ai.catalog() });
      }
    },
  });
  const change = (body: AiSettingsUpdateBody, options: ChangeOptions) => {
    const before = client.getQueryData<AiSettingsResponse>(queryKeys.ai.settings());
    mutation.mutate(body, {
      onSuccess: () => {
        if (options.undo === false || !before) toast(options.title);
        else undoToast(options.title, () => mutation.mutate(inverseOf(before, body)));
      },
    });
  };
  return {
    canConfigure,
    query,
    settings: query.data,
    change,
    /** Resolves when the change is stored; for forms that wait (the budget). */
    save: (body: AiSettingsUpdateBody) => mutation.mutateAsync(body),
    pending: mutation.isPending,
  };
}

export type AiAdminSettings = ReturnType<typeof useAiAdminSettings>;
