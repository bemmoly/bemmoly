import type {
  AiCatalogModelEntry,
  AiCatalogProviderSummary,
  AiModelCapabilities,
  AiRole,
  CatalogModel,
  CatalogProvider,
} from '@bemmoly/shared';
import providers from '../../fixtures/ai-catalog.json' with { type: 'json' };
import models from '../../fixtures/ai-models.json' with { type: 'json' };
import { providerLogoUrl } from '../../lib/provider-logos.ts';

/**
 * The mock's catalog: the bundled provider list, and a trimmed excerpt of models.dev's models
 * for the popular providers, so the role pickers have real names, limits and prices.
 */
const PROVIDERS = providers as {
  popular: string[];
  providers: {
    id: string;
    name: string;
    env: string[];
    api: string | null;
    doc: string;
    npm: string;
  }[];
};
const MODELS = models as unknown as Record<string, CatalogProvider>;

export const CATALOG_POPULAR = PROVIDERS.popular;

/** The runtime's allow-list in short: the official packages and one third-party provider package. */
const allowListed = (npm: string) => npm.startsWith('@ai-sdk/') || npm.endsWith('/ai-sdk-provider');

export function catalogSummaries(): AiCatalogProviderSummary[] {
  return PROVIDERS.providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    env: provider.env,
    api: provider.api,
    doc: provider.doc,
    npm: provider.npm,
    loader: allowListed(provider.npm) ? 'package' : 'compatible',
    modelCount: Object.keys(MODELS[provider.id]?.models ?? {}).length,
    logoUrl: providerLogoUrl(provider.id),
  }));
}

export function catalogSummary(id: string): AiCatalogProviderSummary | undefined {
  return catalogSummaries().find((provider) => provider.id === id);
}

const isEmbedding = (model: CatalogModel) =>
  model.id.includes('embed') || Boolean(model.modalities?.output?.includes('embedding'));

const writesText = (model: CatalogModel) =>
  !isEmbedding(model) && (model.modalities?.output?.includes('text') ?? true);

/** As the runtime decides: text for the language roles, tool calling for strong. */
export function eligibleRoles(model: CatalogModel): AiRole[] {
  if (isEmbedding(model)) return ['embedding'];
  if (!writesText(model)) return [];
  return model.tool_call ? ['fast', 'standard', 'strong'] : ['fast', 'standard'];
}

const inputCost = (model: CatalogModel) => model.cost?.input ?? Number.POSITIVE_INFINITY;

/** The suggested default per role: cheapest for fast, priciest tool caller for strong. */
function suggestions(list: readonly CatalogModel[]): Partial<Record<AiRole, string>> {
  const language = list.filter((model) => eligibleRoles(model).includes('standard'));
  const byCost = [...language].sort((a, b) => inputCost(a) - inputCost(b));
  const tools = byCost.filter((model) => model.tool_call);
  return {
    fast: byCost[0]?.id,
    standard: (tools[Math.floor(tools.length / 2)] ?? byCost[0])?.id,
    strong: (tools.at(-1) ?? byCost.at(-1))?.id,
    embedding: list.find(isEmbedding)?.id,
  };
}

function entry(model: CatalogModel, suggested: Partial<Record<AiRole, string>>) {
  const roles = eligibleRoles(model);
  return {
    id: model.id,
    name: model.name,
    family: model.family ?? null,
    toolCall: Boolean(model.tool_call),
    structuredOutput: Boolean(model.structured_output),
    reasoning: Boolean(model.reasoning),
    attachment: Boolean(model.attachment),
    contextWindow: model.limit?.context ?? null,
    maxOutput: model.limit?.output ?? null,
    inputCostPerMillion: model.cost?.input ?? null,
    outputCostPerMillion: model.cost?.output ?? null,
    releaseDate: model.release_date ?? null,
    deprecated: model.status === 'deprecated',
    eligibleRoles: roles,
    suggestedFor: roles.filter((role) => suggested[role] === model.id),
  } satisfies AiCatalogModelEntry;
}

/** The role picker's list for one catalog provider; empty for one the excerpt leaves out. */
export function catalogModels(id: string): AiCatalogModelEntry[] {
  const list = Object.values(MODELS[id]?.models ?? {});
  const suggested = suggestions(list);
  return list.map((model) => entry(model, suggested));
}

/** What a role stores about its model, copied from the catalog when it is assigned. */
export function capabilitiesOf(entry: AiCatalogModelEntry | undefined): AiModelCapabilities {
  return {
    toolCall: entry?.toolCall ?? false,
    structuredOutput: entry?.structuredOutput ?? false,
    reasoning: entry?.reasoning ?? false,
    attachment: entry?.attachment ?? false,
    temperature: true,
    contextWindow: entry?.contextWindow ?? null,
    maxOutput: entry?.maxOutput ?? null,
    inputModalities: ['text'],
    outputModalities: entry?.eligibleRoles.includes('embedding') ? ['embedding'] : ['text'],
    cost:
      entry?.inputCostPerMillion == null
        ? null
        : {
            input: entry.inputCostPerMillion,
            output: entry.outputCostPerMillion ?? 0,
            cacheRead: null,
            cacheWrite: null,
          },
    dimensions: entry?.eligibleRoles.includes('embedding') ? 1536 : null,
    status: entry?.deprecated ? 'deprecated' : null,
    releaseDate: entry?.releaseDate ?? null,
  };
}

/** The first popular provider whose excerpt fills every role: the demo's believable choice. */
export function demoProviderId(): string {
  const complete = CATALOG_POPULAR.find((id) => {
    const suggested = suggestions(Object.values(MODELS[id]?.models ?? {}));
    return Boolean(suggested.fast && suggested.strong && suggested.embedding);
  });
  return complete ?? CATALOG_POPULAR[0] ?? '';
}
