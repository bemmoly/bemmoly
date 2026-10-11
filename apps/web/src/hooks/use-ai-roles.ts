import { queryKeys } from '@bemmoly/api-client';
import {
  AI_ROLES,
  type AiCatalogModelEntry,
  type AiModelRole,
  type AiModelRolesResponse,
  type AiProvider,
  type AiRole,
} from '@bemmoly/shared';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { describeError } from '../lib/errors.ts';
import { toast, undoToast } from '../lib/toast.ts';
import { aiProvidersQuery, aiRolesQuery } from './use-ai-admin.ts';
import { catalogModelsQuery } from './use-ai-catalog.ts';
import { aiAdminApi } from '../lib/ai-admin-api.ts';

export const ROLE_COPY: Record<AiRole, { label: string; description: string }> = {
  fast: {
    label: 'Fast',
    description: 'Field suggestions, classification and title clean-up, where 300 ms matters',
  },
  standard: { label: 'Standard', description: 'Summaries, briefs and answers about your work' },
  strong: {
    label: 'Strong',
    description: 'Plans in the palette, forecasts and drafting. Needs tool calling',
  },
  embedding: { label: 'Embedding', description: 'Search and questions across your docs' },
};

/** A model one connected provider offers, in the role picker's terms. */
export interface RoleModel {
  providerId: string;
  providerName: string;
  model: AiCatalogModelEntry;
}

/** A Local server's discovered model, described the way the catalog describes models. */
export function discoveredEntry(provider: AiProvider, index: number): AiCatalogModelEntry {
  const found = provider.models[index];
  const embedding = Boolean(found?.embedding);
  const roles: AiRole[] = embedding
    ? ['embedding']
    : found?.toolCall
      ? ['fast', 'standard', 'strong']
      : ['fast', 'standard'];
  return {
    id: found?.id ?? '',
    name: found?.name ?? '',
    family: null,
    toolCall: Boolean(found?.toolCall),
    structuredOutput: Boolean(found?.structuredOutput),
    reasoning: false,
    attachment: false,
    contextWindow: found?.contextWindow ?? null,
    maxOutput: null,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    releaseDate: null,
    deprecated: false,
    eligibleRoles: roles,
    suggestedFor: [],
  };
}

/** Every model of every connected provider, catalog providers' from the catalog. */
function useRoleModels(providers: readonly AiProvider[]) {
  const catalogIds = [
    ...new Set(providers.map((p) => p.catalogId).filter((id) => id !== 'custom')),
  ];
  const results = useQueries({ queries: catalogIds.map((id) => catalogModelsQuery(id)) });
  const byCatalog = new Map(catalogIds.map((id, i) => [id, results[i]?.data?.models ?? []]));
  const models: RoleModel[] = providers.flatMap((provider) =>
    (provider.catalogId === 'custom'
      ? provider.models.map((_, index) => discoveredEntry(provider, index))
      : (byCatalog.get(provider.catalogId) ?? [])
    ).map((model) => ({ providerId: provider.id, providerName: provider.name, model })),
  );
  return { models, loading: results.some((result) => result.isPending) };
}

/** The value a role's select holds: provider and model together. */
export const optionValue = (providerId: string, model: string) => `${providerId}::${model}`;

export function parseOption(value: string): { providerId: string; model: string } {
  const [providerId = '', ...rest] = value.split('::');
  return { providerId, model: rest.join('::') };
}

/** The models that can fill a role; deprecated ones stay listed only while assigned. */
export function eligibleFor(
  role: AiRole,
  models: readonly RoleModel[],
  current?: AiModelRole | null,
) {
  return models.filter(
    (entry) =>
      entry.model.eligibleRoles.includes(role) &&
      (!entry.model.deprecated ||
        (current?.providerId === entry.providerId && current.model === entry.model.id)),
  );
}

/** The model a new provider suggests for a role: the catalog's pick, else the first that fits. */
export function suggestedModel(role: AiRole, models: readonly AiCatalogModelEntry[]) {
  const fits = models.filter((model) => model.eligibleRoles.includes(role) && !model.deprecated);
  return fits.find((model) => model.suggestedFor.includes(role)) ?? fits[0] ?? null;
}

/** Model roles: what fills each, what could, and assigning one in place with Undo. */
export function useAiRoles(enabled = true) {
  const client = useQueryClient();
  const providers = useQuery({ ...aiProvidersQuery, enabled });
  const roles = useQuery({ ...aiRolesQuery, enabled });
  const list = providers.data?.items ?? [];
  const { models, loading } = useRoleModels(list);
  const assign = useMutation({
    mutationFn: async ({ role, value }: { role: AiRole; value: string | null }) => {
      if (value === null) return aiAdminApi.roles.clear(role);
      const { providerId, model } = parseOption(value);
      return aiAdminApi.roles.assign(role, {
        providerId,
        model,
        reasoningEffort: null,
        maxOutputTokens: null,
        temperature: null,
      });
    },
    onError: (error) => toast(describeError(error).message, 'danger'),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.ai.roles() });
      await client.invalidateQueries({ queryKey: queryKeys.me() });
      await client.invalidateQueries({ queryKey: queryKeys.ai.status() });
    },
  });
  const assignment = (role: AiRole) =>
    roles.data?.items.find((item) => item.role === role)?.assignment ?? null;
  const choose = (role: AiRole, value: string) => {
    const before = assignment(role);
    const previous = before ? optionValue(before.providerId, before.model) : null;
    if (previous === value) return;
    const picked = models.find((entry) => optionValue(entry.providerId, entry.model.id) === value);
    const cached = client.getQueryData<AiModelRolesResponse>(queryKeys.ai.roles());
    assign.mutate(
      { role, value },
      {
        onSuccess: () =>
          undoToast(
            `${ROLE_COPY[role].label} now uses ${picked?.model.name ?? 'that model'}`,
            () => {
              if (cached) client.setQueryData(queryKeys.ai.roles(), cached);
              assign.mutate({ role, value: previous });
            },
          ),
      },
    );
  };
  /**
   * After a provider connects, every empty role takes its suggested model from it, so the
   * common case needs no further choice. Roles already filled are left alone.
   */
  const fillDefaults = async (provider: AiProvider) => {
    const current = await client.fetchQuery(aiRolesQuery);
    const models =
      provider.catalogId === 'custom'
        ? provider.models.map((_, index) => discoveredEntry(provider, index))
        : (await client.fetchQuery(catalogModelsQuery(provider.catalogId))).models;
    const empty = current.items.filter((item) => item.assignment === null).map((item) => item.role);
    let filled = 0;
    for (const role of empty) {
      const model = suggestedModel(role, models);
      if (!model) continue;
      filled += 1;
      await aiAdminApi.roles.assign(role, {
        providerId: provider.id,
        model: model.id,
        reasoningEffort: null,
        maxOutputTokens: null,
        temperature: null,
      });
    }
    await client.invalidateQueries({ queryKey: queryKeys.ai.roles() });
    await client.invalidateQueries({ queryKey: queryKeys.me() });
    return filled;
  };
  return {
    providers,
    roles,
    fillDefaults,
    loading: providers.isPending || roles.isPending || loading,
    error: providers.error ?? roles.error,
    models,
    assignment,
    choose,
    pendingRole: assign.isPending ? (assign.variables?.role ?? null) : null,
    /** What the role's select shows: the choice being saved, else the stored one. */
    valueOf: (role: AiRole): string | null => {
      if (assign.isPending && assign.variables?.role === role) return assign.variables.value;
      const current = assignment(role);
      return current ? optionValue(current.providerId, current.model) : null;
    },
    order: AI_ROLES,
  };
}

export type AiRoles = ReturnType<typeof useAiRoles>;
