import type { SqlClient } from '../../../clients/postgres.ts';
import type { Logger } from '../../../config/logger.ts';
import type { AiFacade, AiModelRef } from '../../../contracts/ai.ts';
import type { JobQueue } from '../../../contracts/jobs.ts';
import type { RetrievalSourceDefinition } from '../../../contracts/retrieval.ts';
import type { SearchProviderDefinition } from '../../../modules/registries.ts';
import type { FromModule } from '../../../modules/registry.ts';

export interface RetrievalDependencies {
  sql: SqlClient;
  /** Read on every call: the server binds the runtime after modules register. */
  ai: () => AiFacade;
  /** Every source modules registered. */
  sources: () => readonly FromModule<RetrievalSourceDefinition>[];
  /** ⌘K's keyword providers; the one with a source's kind is its keyword half. */
  keyword: () => readonly FromModule<SearchProviderDefinition>[];
  /** Live enabled state; a disabled module's records are neither indexed nor retrieved. */
  isEnabled: (moduleId: string) => boolean;
  /** Where index jobs are queued; without it changes are not followed (tests drive directly). */
  jobs?: JobQueue;
  /** The model the embedding role points at now; the facade's when not given. */
  embeddingModel?: () => Promise<AiModelRef | null>;
  logger?: Pick<Logger, 'info' | 'warn'>;
}

export type Source = FromModule<RetrievalSourceDefinition>;

/** The sources of enabled modules. */
export function liveSources(deps: RetrievalDependencies): Source[] {
  return deps.sources().filter((source) => deps.isEnabled(source.moduleId));
}

export function sourceOf(deps: RetrievalDependencies, kind: string): Source | undefined {
  return liveSources(deps).find((source) => source.kind === kind);
}

/**
 * The embedding role's model. Until the facade answers it, the role's row says it: its
 * `model` is the id embed() reports.
 */
export async function currentEmbeddingModel(
  deps: RetrievalDependencies,
): Promise<AiModelRef | null> {
  if (deps.embeddingModel) return deps.embeddingModel();
  const [row] = await deps.sql<{ provider_id: string; model: string; name: string | null }[]>`
    select r.provider_id, r.model, p.name from ai_model_roles r
      left join ai_providers p on p.id = r.provider_id
    where r.role = 'embedding' limit 1`;
  return row
    ? { providerId: row.provider_id, providerName: row.name ?? '', modelId: row.model }
    : null;
}
