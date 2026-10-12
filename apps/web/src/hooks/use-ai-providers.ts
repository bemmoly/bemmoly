import { queryKeys } from '@bemmoly/api-client';
import type { AiProvider, AiProviderListResponse, AiProviderTestResponse } from '@bemmoly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { aiProvidersQuery } from './use-ai-admin.ts';
import { testLine } from './use-ai-connection.ts';
import { aiAdminApi } from '../lib/ai-admin-api.ts';

/** A provider row's status in words: never tested, answering, or the provider's own error. */
export function providerStatus(provider: AiProvider): {
  tone: 'ok' | 'danger' | 'neutral';
  label: string;
  detail: string | null;
} {
  if (provider.status === 'failed') {
    return { tone: 'danger', label: 'Not answering', detail: provider.lastError };
  }
  if (provider.status === 'ok') return { tone: 'ok', label: 'Connected', detail: null };
  return { tone: 'neutral', label: 'Not tested yet', detail: null };
}

/** What the row says the provider is: the catalog's own entry, or a server on your network. */
export function providerKind(provider: AiProvider): string {
  if (provider.catalogId === 'custom') {
    const count = provider.models.length;
    return `Local server · ${provider.baseUrl ?? ''}${count ? ` · ${count} models` : ''}`;
  }
  return provider.loader === 'compatible' ? 'Catalog · through its compatible API' : 'Catalog';
}

/** Connected providers: the list, a test per row, and removing one that fills no role. */
export function useAiProviders(enabled = true) {
  const client = useQueryClient();
  const query = useQuery({ ...aiProvidersQuery, enabled });
  const patchRow = (id: string, patch: Partial<AiProvider>) =>
    client.setQueryData<AiProviderListResponse>(queryKeys.ai.providers(), (data) =>
      data
        ? { items: data.items.map((row) => (row.id === id ? { ...row, ...patch } : row)) }
        : data,
    );
  const test = useMutation({
    mutationFn: (id: string) => aiAdminApi.providers.test(id),
    onSuccess: (result: AiProviderTestResponse, id) => {
      patchRow(id, {
        status: result.ok ? 'ok' : 'failed',
        lastCheckedAt: result.checkedAt,
        lastError: result.ok ? null : result.message,
      });
      toast(testLine(result), result.ok ? 'ok' : 'danger');
    },
    onError: (error) => toast(describeError(error).message, 'danger'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => aiAdminApi.providers.remove(id),
    onSuccess: async (_data, id) => {
      const name = query.data?.items.find((row) => row.id === id)?.name ?? 'Provider';
      toast(`${name} removed`);
      await client.invalidateQueries({ queryKey: queryKeys.ai.all() });
    },
    onError: (error) => toast(describeError(error).message, 'danger'),
  });
  return {
    query,
    items: query.data?.items ?? [],
    test: (id: string) => test.mutate(id),
    testing: test.isPending ? (test.variables ?? null) : null,
    remove: (id: string) => remove.mutateAsync(id),
    removing: remove.isPending,
  };
}

export type AiProviders = ReturnType<typeof useAiProviders>;
