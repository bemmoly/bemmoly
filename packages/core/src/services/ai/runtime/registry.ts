import type { AiLanguageRole, AiModelCapabilities } from '@bemmoly/shared';
import type {
  EmbeddingModel,
  EmbeddingModelMiddleware,
  LanguageModel,
  LanguageModelMiddleware,
} from 'ai';
import type { AiModelRef } from '../../../contracts/ai.ts';
import type { AiRoleDefaults } from './dependencies.ts';

export type { EmbeddingModelMiddleware, LanguageModelMiddleware };

/** What a call is for, as a recorded model source keys its replies. */
export interface AiCallKey {
  purpose: string;
  promptId: string | null;
}

/** A role resolved to a callable model: the SDK object plus what the facade records. */
export interface ResolvedLanguageModel {
  model: Exclude<LanguageModel, string>;
  ref: AiModelRef;
  capabilities: AiModelCapabilities | null;
  defaults: AiRoleDefaults;
}

export interface ResolvedEmbeddingModel {
  model: Exclude<EmbeddingModel, string>;
  ref: AiModelRef;
  capabilities: AiModelCapabilities | null;
}

/**
 * Resolves roles to models. The database-backed one reads ai_model_roles and ai_providers and
 * loads provider packages through the loader; tests pass a static one.
 */
export interface AiModelSource {
  /** `call` lets a recorded source answer per purpose or prompt; real sources ignore it. */
  language(role: AiLanguageRole, call?: AiCallKey): Promise<ResolvedLanguageModel | null>;
  embedding(): Promise<ResolvedEmbeddingModel | null>;
  /** Drops cached models after a provider or role changes. */
  invalidate(): void;
}

/** A model source over fixed models, for tests and the test fake. */
export function createStaticModelSource(models: {
  language?: Partial<Record<AiLanguageRole, ResolvedLanguageModel>>;
  embedding?: ResolvedEmbeddingModel;
}): AiModelSource {
  return {
    language: async (role) => models.language?.[role] ?? null,
    embedding: async () => models.embedding ?? null,
    invalidate: () => undefined,
  };
}
