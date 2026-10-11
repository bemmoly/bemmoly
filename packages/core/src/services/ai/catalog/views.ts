import {
  NotFoundError,
  type AiCatalogProviderResponse,
  type AiCatalogProviderSummary,
  type AiCatalogResponse,
  type CatalogData,
  type CatalogProvider,
} from '@bemmoly/shared';
import { loaderKindOf } from '../runtime/loader.ts';
import { modelEntry, modelsOf, POPULAR_PROVIDERS, suggestedDefaults } from './overrides.ts';
import type { ResolvedCatalog } from './resolver.ts';

export const LOGO_PATH = '/api/v1/admin/ai/catalog/logos';

function summary(
  provider: CatalogProvider,
  logoIds: ReadonlySet<string>,
): AiCatalogProviderSummary {
  return {
    id: provider.id,
    name: provider.name,
    env: provider.env,
    api: provider.api ?? null,
    doc: provider.doc,
    npm: provider.npm,
    loader: loaderKindOf(provider.npm),
    modelCount: modelsOf(provider).length,
    logoUrl: logoIds.has(provider.id) ? `${LOGO_PATH}/${encodeURIComponent(provider.id)}` : null,
  };
}

/** The picker's data: Popular row ids present in this catalog, every provider by name. */
export function catalogResponse(
  resolved: ResolvedCatalog,
  logoIds: ReadonlySet<string>,
): AiCatalogResponse {
  const providers = Object.values(resolved.data)
    .map((provider) => summary(provider, logoIds))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  return {
    status: resolved.status,
    popular: POPULAR_PROVIDERS.filter((id) => resolved.data[id]),
    providers,
  };
}

/** One provider's models with their role eligibility and the suggested default per role. */
export function providerResponse(
  data: CatalogData,
  id: string,
  logoIds: ReadonlySet<string>,
): AiCatalogProviderResponse {
  const provider = data[id];
  if (!provider) throw new NotFoundError(`The catalog has no provider "${id}"`);
  const suggested = suggestedDefaults(provider);
  const models = modelsOf(provider)
    .map((model) => modelEntry(model, suggested))
    .sort(
      (a, b) =>
        Number(a.deprecated) - Number(b.deprecated) ||
        (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') ||
        a.name.localeCompare(b.name),
    );
  return { provider: summary(provider, logoIds), models };
}
