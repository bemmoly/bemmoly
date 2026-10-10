import {
  catalogDataSchema,
  ValidationError,
  type CatalogData,
  type CatalogModel,
} from '@bemmoly/shared';

/** The model fields Bemmoly reads; the rest of models.dev's entry is dropped. */
const MODEL_FIELDS = [
  'id',
  'name',
  'family',
  'attachment',
  'reasoning',
  'tool_call',
  'structured_output',
  'temperature',
  'release_date',
  'last_updated',
  'open_weights',
  'status',
  'modalities',
  'limit',
  'cost',
] as const;

const COST_FIELDS = ['input', 'output', 'cache_read', 'cache_write'] as const;

function pick<T extends object>(source: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out as Partial<T>;
}

function trimModel(raw: Record<string, unknown>): Record<string, unknown> {
  const model = pick(raw, MODEL_FIELDS) as Record<string, unknown>;
  if (model['cost'] && typeof model['cost'] === 'object') {
    model['cost'] = pick(model['cost'] as object, COST_FIELDS);
  }
  if (model['limit'] && typeof model['limit'] === 'object') {
    model['limit'] = pick(model['limit'] as object, ['context', 'output']);
  }
  return model;
}

/**
 * models.dev's api.json trimmed to what the picker and runtime read, then validated. Providers
 * or models that do not fit the shape are dropped rather than failing the whole catalog.
 */
export function trimCatalog(raw: unknown): CatalogData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('A catalog is an object of providers keyed by id');
  }
  const trimmed: Record<string, unknown> = {};
  for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const provider = pick(entry as Record<string, unknown>, [
      'id',
      'name',
      'env',
      'npm',
      'api',
      'doc',
    ]);
    const models: Record<string, unknown> = {};
    const rawModels = (entry as { models?: unknown }).models;
    for (const [modelId, model] of Object.entries(
      rawModels && typeof rawModels === 'object' ? (rawModels as Record<string, unknown>) : {},
    )) {
      if (model && typeof model === 'object')
        models[modelId] = trimModel(model as Record<string, unknown>);
    }
    trimmed[id] = { ...provider, id: provider.id ?? id, models };
  }
  const valid: CatalogData = {};
  for (const [id, provider] of Object.entries(trimmed)) {
    const parsed = catalogDataSchema.safeParse({ [id]: provider });
    if (parsed.success) valid[id] = parsed.data[id]!;
  }
  if (Object.keys(valid).length === 0) {
    throw new ValidationError('The catalog has no providers Bemmoly can read');
  }
  return valid;
}

export function countModels(data: CatalogData): number {
  return Object.values(data).reduce(
    (sum, provider) => sum + Object.keys(provider.models).length,
    0,
  );
}

export function findModel(
  data: CatalogData,
  providerId: string,
  modelId: string,
): CatalogModel | null {
  return data[providerId]?.models[modelId] ?? null;
}
