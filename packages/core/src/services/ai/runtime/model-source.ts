import type { AiLanguageRole, AiRole, CatalogData } from '@bemmoly/shared';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import type { SecretBox } from '../../settings/index.ts';
import { findProvider, openSecrets, type ProviderRow } from '../store/providers.ts';
import { listRoles, type RoleRow } from '../store/roles.ts';
import { loadProvider, type LoadedProvider, type ProviderConnection } from './loader.ts';
import type { AiModelSource, ResolvedEmbeddingModel, ResolvedLanguageModel } from './registry.ts';

export interface DbModelSourceDeps {
  sql: SqlExecutor;
  secrets: SecretBox;
  /** The catalog without a network request, for the provider's package name. */
  catalog: () => Promise<CatalogData>;
}

/** A stored provider as the loader needs it, secrets opened. */
export async function connectionOf(
  row: ProviderRow,
  secrets: SecretBox,
  catalog: () => Promise<CatalogData>,
): Promise<ProviderConnection> {
  const entry = row.protocol ? null : (await catalog())[row.catalogId];
  return {
    catalogId: row.catalogId,
    npm: entry?.npm ?? null,
    protocol: row.protocol,
    name: row.name,
    baseUrl: row.baseUrl ?? entry?.api ?? null,
    credentials: openSecrets(secrets, row.id, 'credentials', row.credentialsSealed),
    headers: openSecrets(secrets, row.id, 'headers', row.headersSealed),
  };
}

/**
 * Roles to models from ai_model_roles and ai_providers. The facade reads the model id and
 * capabilities snapshot stored on the role, never the live catalog, so a catalog outage
 * cannot stop AI calls. Loaded providers are cached until a provider or role changes.
 */
export function createDbModelSource(deps: DbModelSourceDeps): AiModelSource {
  let roles: Promise<Map<AiRole, RoleRow>> | null = null;
  const providers = new Map<string, Promise<LoadedProvider>>();

  const roleMap = () => {
    roles ??= listRoles(deps.sql).then((rows) => new Map(rows.map((row) => [row.role, row])));
    roles.catch(() => {
      roles = null;
    });
    return roles;
  };

  const providerOf = (id: string) => {
    let pending = providers.get(id);
    if (!pending) {
      pending = (async () => {
        const row = await findProvider(deps.sql, id);
        if (!row) throw new Error(`AI provider ${id} no longer exists`);
        return loadProvider(await connectionOf(row, deps.secrets, deps.catalog));
      })();
      providers.set(id, pending);
      pending.catch(() => providers.delete(id));
    }
    return pending;
  };

  const ref = (row: RoleRow) => ({
    providerId: row.providerId,
    providerName: row.providerName,
    modelId: row.model,
  });

  return {
    async language(role: AiLanguageRole): Promise<ResolvedLanguageModel | null> {
      const row = (await roleMap()).get(role);
      if (!row) return null;
      const provider = await providerOf(row.providerId);
      return {
        model: provider.languageModel(row.model),
        ref: ref(row),
        capabilities: row.capabilities,
        defaults: {
          maxOutputTokens: row.maxOutputTokens,
          temperature: row.temperature,
          reasoningEffort: row.reasoningEffort,
        },
      };
    },
    async embedding(): Promise<ResolvedEmbeddingModel | null> {
      const row = (await roleMap()).get('embedding');
      if (!row) return null;
      const provider = await providerOf(row.providerId);
      return {
        model: provider.embeddingModel(row.model),
        ref: ref(row),
        capabilities: row.capabilities,
      };
    },
    invalidate() {
      roles = null;
      providers.clear();
    },
  };
}
