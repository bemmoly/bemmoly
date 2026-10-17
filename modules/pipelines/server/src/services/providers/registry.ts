import { ProviderError } from '@bemmoly/shared';
import type { Provider } from '../../../../shared/common.ts';
import type { ProviderInfo } from '../../../../shared/clouds.ts';
import { PROVIDER_PARTS, partAvailability, type CloudProvider } from './contract.ts';

/*
 * The one place providers are looked up. Adding a cloud is one file implementing the
 * contract plus one line where the registry is built; nothing else names a provider.
 */

export interface ProviderRegistry {
  get(id: Provider): CloudProvider;
  list(): readonly CloudProvider[];
  /** Platform › Clouds' provider cards. */
  info(): ProviderInfo[];
}

export function createProviderRegistry(providers: readonly CloudProvider[]): ProviderRegistry {
  const byId = new Map(providers.map((provider) => [provider.id, provider]));
  return {
    get(id) {
      const provider = byId.get(id);
      if (!provider)
        throw new ProviderError(`No provider is installed for ${id}`, { provider: id });
      return provider;
    },
    list: () => providers,
    info: () =>
      providers.map((provider) => ({
        provider: provider.id,
        name: provider.name,
        description: provider.description,
        availability: PROVIDER_PARTS.some(
          (part) => partAvailability(provider, part) === 'available',
        )
          ? 'available'
          : 'coming_soon',
      })),
  };
}

/** A cloud that is designed for but not built yet: every part says "Coming soon". */
export function comingSoonProvider(id: Provider, name: string, description: string): CloudProvider {
  return { id, name, description, comingSoon: PROVIDER_PARTS };
}
