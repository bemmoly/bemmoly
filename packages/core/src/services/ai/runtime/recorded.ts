import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  createMockEmbeddingModel,
  createMockLanguageModel,
  mockEmbedding,
  mockLanguage,
  type MockReply,
} from './mock-models.ts';
import type { AiCallKey, AiModelSource } from './registry.ts';

/**
 * The recorded provider (BEMMOLY_AI_RECORDING): replies read from a JSON file, keyed by the
 * prompt id or the purpose, so end-to-end tests run the real server with AI on and no vendor.
 * Each list plays in order and then repeats its last reply.
 */
const replySchema = z.union([
  z.object({ text: z.string(), delayMs: z.number().int().nonnegative().optional() }),
  z.object({ object: z.unknown(), delayMs: z.number().int().nonnegative().optional() }),
  z.object({
    error: z.object({ statusCode: z.number().int(), message: z.string().optional() }),
  }),
]);

export const recordingSchema = z.object({
  replies: z.record(z.string(), z.array(replySchema).min(1)).default({}),
  fallback: replySchema.default({ text: 'ok' }),
  dimensions: z.number().int().positive().max(4096).default(8),
});
export type Recording = z.infer<typeof recordingSchema>;

export function readRecording(path: string): Recording {
  return recordingSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

function toMockReply(reply: z.infer<typeof replySchema>): MockReply {
  if ('error' in reply) {
    const error = Object.assign(new Error(reply.error.message ?? 'Recorded provider failure'), {
      name: 'AI_APICallError',
      statusCode: reply.error.statusCode,
      isRetryable: false,
    });
    return { error };
  }
  return 'text' in reply ? { text: reply.text } : { object: reply.object };
}

export function createRecordedModelSource(recording: Recording): AiModelSource {
  const played = new Map<string, number>();

  const replyFor = (key: AiCallKey) => {
    const name = [key.promptId, key.purpose].find(
      (candidate): candidate is string => !!candidate && !!recording.replies[candidate],
    );
    if (!name) return recording.fallback;
    const list = recording.replies[name]!;
    const index = played.get(name) ?? 0;
    played.set(name, index + 1);
    return list[Math.min(index, list.length - 1)]!;
  };

  return {
    async language(role: string, call?: AiCallKey) {
      const reply = replyFor(call ?? { purpose: role, promptId: null });
      const delay = 'delayMs' in reply ? (reply.delayMs ?? 0) : 0;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const model = createMockLanguageModel({
        next: () => toMockReply(reply),
        calls: [],
        modelId: `recorded-${role}`,
      });
      const resolved = mockLanguage(model);
      return { ...resolved, ref: { ...resolved.ref, providerName: 'Recorded provider' } };
    },
    async embedding() {
      const resolved = mockEmbedding(createMockEmbeddingModel(recording.dimensions, []));
      return { ...resolved, ref: { ...resolved.ref, providerName: 'Recorded provider' } };
    },
    invalidate: () => undefined,
  };
}
