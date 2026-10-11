import type { AiLanguageRole, AiModelCapabilities } from '@bemmoly/shared';
import {
  embedMany,
  generateText,
  jsonSchema,
  Output,
  tool,
  type EmbeddingModel,
  type EmbeddingModelMiddleware,
  type LanguageModel,
  type LanguageModelMiddleware,
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

/**
 * One cheap call: a few output tokens, no retries, a short timeout. Throws the SDK's error so
 * the caller can turn it into honest copy.
 */
export async function pingModel(
  model: Exclude<LanguageModel, string>,
  timeoutMs: number,
): Promise<void> {
  await generateText({
    model,
    prompt: 'Reply with the single word: ok',
    maxOutputTokens: 16,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(timeoutMs),
  });
}

export async function pingEmbedding(
  model: Exclude<EmbeddingModel, string>,
  timeoutMs: number,
): Promise<number> {
  const result = await embedMany({
    model,
    values: ['ok'],
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(timeoutMs),
  });
  return result.embeddings[0]?.length ?? 0;
}

/** Whether the model calls a tool when asked to: one request. */
export async function probeToolCalling(
  model: Exclude<LanguageModel, string>,
  timeoutMs: number,
): Promise<boolean> {
  try {
    const result = await generateText({
      model,
      prompt: 'Call the record tool with the value 7.',
      tools: {
        record: tool({
          description: 'Records a number',
          inputSchema: jsonSchema<{ value: number }>({
            type: 'object',
            properties: { value: { type: 'number' } },
            required: ['value'],
          }),
        }),
      },
      toolChoice: 'required',
      maxOutputTokens: 64,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    return result.toolCalls.length > 0;
  } catch {
    return false;
  }
}

/** Whether the model returns JSON matching a small schema: one request. */
export async function probeStructuredOutput(
  model: Exclude<LanguageModel, string>,
  timeoutMs: number,
): Promise<boolean> {
  try {
    const result = await generateText({
      model,
      prompt: 'Return the colour of a clear daytime sky.',
      output: Output.object({
        schema: jsonSchema<{ colour: string }>({
          type: 'object',
          properties: { colour: { type: 'string' } },
          required: ['colour'],
        }),
      }),
      maxOutputTokens: 64,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    return typeof result.output?.colour === 'string';
  } catch {
    return false;
  }
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
