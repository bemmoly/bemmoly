import {
  AI_ROLES,
  type AiCatalogModelEntry,
  type AiModelCapabilities,
  type AiRole,
  type CatalogModel,
  type CatalogProvider,
} from '@bemmoly/shared';
import overrides from './overrides.json' with { type: 'json' };

/**
 * Bemmoly's few opinions on top of the catalog, kept as data in overrides.json: the Popular
 * row (catalog ids), name fragments that suggest a default per role, curated embedding models
 * (thin in the catalog) with their vector size, and the Local server entry.
 */
export const POPULAR_PROVIDERS: readonly string[] = overrides.popular;
export const LOCAL_SERVER = overrides.localServer;

interface CuratedEmbedding {
  id: string;
  name: string;
  dimensions: number;
  input: number;
}

const curated = overrides.embeddingModels as Record<string, CuratedEmbedding[] | undefined>;

export function isEmbeddingModel(model: CatalogModel): boolean {
  return (
    /embed/i.test(model.id) ||
    (model.modalities?.output ?? []).includes('embedding') ||
    (model.modalities?.output ?? []).includes('embeddings')
  );
}

/** The provider's models plus curated embedding models the catalog does not list. */
export function modelsOf(provider: CatalogProvider): CatalogModel[] {
  const models = Object.values(provider.models);
  for (const extra of curated[provider.id] ?? []) {
    if (provider.models[extra.id]) continue;
    models.push({
      id: extra.id,
      name: extra.name,
      modalities: { input: ['text'], output: ['embedding'] },
      cost: { input: extra.input, output: 0 },
    });
  }
  return models;
}

export function dimensionsOf(providerId: string, modelId: string): number | null {
  return curated[providerId]?.find((entry) => entry.id === modelId)?.dimensions ?? null;
}

export function isDeprecated(model: CatalogModel): boolean {
  return model.status === 'deprecated';
}

/** fast and standard need text out; strong plans, so it needs tool calling too. */
export function eligibleRoles(model: CatalogModel): AiRole[] {
  if (isEmbeddingModel(model)) return ['embedding'];
  const output = model.modalities?.output;
  if (output && !output.includes('text')) return [];
  return model.tool_call ? ['fast', 'standard', 'strong'] : ['fast', 'standard'];
}

const byRecency = (a: CatalogModel, b: CatalogModel) =>
  (b.release_date ?? '').localeCompare(a.release_date ?? '');

/** The suggested model per role for one provider: the newest match of the first fragment. */
export function suggestedDefaults(provider: CatalogProvider): Partial<Record<AiRole, string>> {
  const models = modelsOf(provider)
    .filter((model) => !isDeprecated(model))
    .sort(byRecency);
  const result: Partial<Record<AiRole, string>> = {};
  for (const role of AI_ROLES) {
    const eligible = models.filter((model) => eligibleRoles(model).includes(role));
    const fragments = (overrides.suggested as Record<AiRole, string[]>)[role];
    const match =
      fragments
        .map((fragment) => eligible.find((model) => model.id.toLowerCase().includes(fragment)))
        .find(Boolean) ?? eligible[0];
    if (match) result[role] = match.id;
  }
  return result;
}

/** The successor the deprecation warning suggests: the newest live model of the same family. */
export function successorOf(provider: CatalogProvider, model: CatalogModel): string | null {
  if (!model.family) return null;
  const next = Object.values(provider.models)
    .filter((m) => m.family === model.family && !isDeprecated(m) && m.id !== model.id)
    .sort(byRecency)[0];
  return next?.id ?? null;
}

export function capabilitiesOf(providerId: string, model: CatalogModel): AiModelCapabilities {
  const cost = model.cost;
  return {
    toolCall: model.tool_call ?? false,
    structuredOutput: model.structured_output ?? false,
    reasoning: model.reasoning ?? false,
    attachment: model.attachment ?? false,
    temperature: model.temperature ?? true,
    contextWindow: model.limit?.context || null,
    maxOutput: model.limit?.output || null,
    inputModalities: model.modalities?.input ?? ['text'],
    outputModalities: model.modalities?.output ?? ['text'],
    cost:
      cost?.input !== undefined
        ? {
            input: cost.input,
            output: cost.output ?? 0,
            cacheRead: cost.cache_read ?? null,
            cacheWrite: cost.cache_write ?? null,
          }
        : null,
    dimensions: dimensionsOf(providerId, model.id),
    status: model.status ?? null,
    releaseDate: model.release_date ?? null,
  };
}

export function modelEntry(
  model: CatalogModel,
  suggested: Partial<Record<AiRole, string>>,
): AiCatalogModelEntry {
  return {
    id: model.id,
    name: model.name,
    family: model.family ?? null,
    toolCall: model.tool_call ?? false,
    structuredOutput: model.structured_output ?? false,
    reasoning: model.reasoning ?? false,
    attachment: model.attachment ?? false,
    contextWindow: model.limit?.context || null,
    maxOutput: model.limit?.output || null,
    inputCostPerMillion: model.cost?.input ?? null,
    outputCostPerMillion: model.cost?.output ?? null,
    releaseDate: model.release_date ?? null,
    deprecated: isDeprecated(model),
    eligibleRoles: eligibleRoles(model),
    suggestedFor: AI_ROLES.filter((role) => suggested[role] === model.id),
  };
}
