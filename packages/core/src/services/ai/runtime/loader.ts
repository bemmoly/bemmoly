import type { AiCustomProtocol, AiLoaderKind } from '@bemmoly/shared';
import type { EmbeddingModel, LanguageModel } from 'ai';
import allowList from './allow-list.json' with { type: 'json' };
import credentialOptions from './credential-options.json' with { type: 'json' };

/**
 * Loads AI SDK provider packages by the name the catalog gives (its `npm` field), only from
 * the allow-list bundled in the image (allow-list.json, data). Anything else, and a catalog
 * entry without a package, uses the generic compatible client over the provider's base URL.
 * Which credential fills which factory option is data too (credential-options.json), keyed by
 * the suffix of the catalog's env names, so no file here knows a vendor.
 */
const ALLOWED: ReadonlySet<string> = new Set(allowList);

export interface ProviderConnection {
  /** A catalog provider id, or "custom". */
  catalogId: string;
  /** The catalog's package name; null for a custom endpoint. */
  npm: string | null;
  protocol: AiCustomProtocol | null;
  name: string;
  baseUrl: string | null;
  credentials: Readonly<Record<string, string>>;
  headers: Readonly<Record<string, string>>;
}

export interface LoadedProvider {
  loader: AiLoaderKind;
  languageModel(modelId: string): Exclude<LanguageModel, string>;
  embeddingModel(modelId: string): Exclude<EmbeddingModel, string>;
}

export class ProviderLoadError extends Error {
  override readonly name = 'ProviderLoadError';
}

type Factory = (options: Record<string, unknown>) => {
  languageModel?: (id: string) => unknown;
  embeddingModel?: (id: string) => unknown;
  textEmbeddingModel?: (id: string) => unknown;
};

/** Whether the runtime has the catalog's package or falls back to the compatible client. */
export function loaderKindOf(npm: string | null | undefined): AiLoaderKind {
  return npm && ALLOWED.has(npm) && npm !== credentialOptions.compatible ? 'package' : 'compatible';
}

function packageFor(connection: ProviderConnection): { name: string; loader: AiLoaderKind } {
  if (connection.protocol) {
    return { name: credentialOptions.protocols[connection.protocol], loader: 'compatible' };
  }
  const loader = loaderKindOf(connection.npm);
  return { name: loader === 'package' ? connection.npm! : credentialOptions.compatible, loader };
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let node = target;
  for (const key of keys.slice(0, -1)) {
    node[key] = (node[key] as Record<string, unknown> | undefined) ?? {};
    node = node[key] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]!] = value;
}

/** The factory options from the stored credentials, by env-name suffix. */
export function factoryOptions(connection: ProviderConnection): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(connection.credentials)) {
    const rule = credentialOptions.suffixes.find((entry) =>
      name.toUpperCase().endsWith(entry.suffix),
    );
    if (!rule) continue;
    let parsed: unknown = value;
    if ('json' in rule && rule.json) {
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new ProviderLoadError(`${name} must be the JSON the provider issued`);
      }
    }
    if (rule.option === 'apiKey' && options['apiKey'] !== undefined) continue;
    setPath(options, rule.option, parsed);
  }
  if (connection.baseUrl) options['baseURL'] = connection.baseUrl;
  if (Object.keys(connection.headers).length) options['headers'] = { ...connection.headers };
  // The compatible client needs a name for its provider id and a base URL to call.
  options['name'] = connection.catalogId === 'custom' ? 'custom' : connection.catalogId;
  return options;
}

const loaded = new Map<string, Promise<Factory>>();

async function factoryOf(packageName: string): Promise<Factory> {
  if (!ALLOWED.has(packageName)) {
    throw new ProviderLoadError(`${packageName} is not in the bundled provider allow-list`);
  }
  let pending = loaded.get(packageName);
  if (!pending) {
    pending = import(packageName).then((module: Record<string, unknown>) => {
      const factories = Object.entries(module)
        .filter(([name, value]) => name.startsWith('create') && typeof value === 'function')
        .sort(([a], [b]) => a.length - b.length);
      const [, factory] = factories[0] ?? [];
      if (!factory) throw new ProviderLoadError(`${packageName} exports no provider factory`);
      return factory as Factory;
    });
    loaded.set(packageName, pending);
    pending.catch(() => loaded.delete(packageName));
  }
  return pending;
}

/** Builds the provider for one stored connection; one code path for every catalog entry. */
export async function loadProvider(connection: ProviderConnection): Promise<LoadedProvider> {
  const { name, loader } = packageFor(connection);
  if (loader === 'compatible' && !connection.baseUrl) {
    throw new ProviderLoadError(`${connection.name} needs a base URL to be reached`);
  }
  const factory = await factoryOf(name);
  const provider = factory(factoryOptions(connection));
  return {
    loader,
    languageModel(modelId) {
      if (!provider.languageModel)
        throw new ProviderLoadError(`${connection.name} has no language models`);
      return provider.languageModel(modelId) as Exclude<LanguageModel, string>;
    },
    embeddingModel(modelId) {
      const make = provider.embeddingModel ?? provider.textEmbeddingModel;
      if (!make) throw new ProviderLoadError(`${connection.name} has no embedding models`);
      return make.call(provider, modelId) as Exclude<EmbeddingModel, string>;
    },
  };
}
