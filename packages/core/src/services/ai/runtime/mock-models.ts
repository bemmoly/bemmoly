import { MockEmbeddingModelV4, MockLanguageModelV4, simulateReadableStream } from 'ai/test';
import type { ResolvedEmbeddingModel, ResolvedLanguageModel } from './registry.ts';
import { NO_ROLE_DEFAULTS } from './dependencies.ts';

/**
 * Test models on the SDK's own mocks, for the test fake and runtime tests. Never used by the
 * server: nothing here reaches a network.
 */
export type MockReply =
  | { text: string }
  | { object: unknown }
  | { toolCalls: { toolName: string; input: unknown }[] }
  | { error: unknown };

export interface MockCall {
  /** The prompt the model received, after redaction. */
  prompt: unknown;
}

const usage = (input: number, output: number) => ({
  inputTokens: { total: input, noCache: input, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: output, text: output, reasoning: 0 },
});

function contentOf(reply: Exclude<MockReply, { error: unknown }>) {
  if ('text' in reply) return [{ type: 'text' as const, text: reply.text }];
  if ('object' in reply) return [{ type: 'text' as const, text: JSON.stringify(reply.object) }];
  return reply.toolCalls.map((call, index) => ({
    type: 'tool-call' as const,
    toolCallId: `call-${index + 1}`,
    toolName: call.toolName,
    input: JSON.stringify(call.input),
  }));
}

export function createMockLanguageModel(options: {
  next: () => MockReply | Promise<MockReply>;
  calls: MockCall[];
  modelId?: string;
}) {
  const answer = async (callOptions: { prompt: unknown }) => {
    options.calls.push({ prompt: callOptions.prompt });
    const reply = await options.next();
    if ('error' in reply) throw reply.error;
    return reply;
  };
  return new MockLanguageModelV4({
    provider: 'test',
    modelId: options.modelId ?? 'test-model',
    doGenerate: async (callOptions) => {
      const reply = await answer(callOptions);
      return {
        content: contentOf(reply),
        finishReason: { unified: 'toolCalls' in reply ? 'tool-calls' : 'stop', raw: undefined },
        usage: usage(10, 5),
        warnings: [],
      } as never;
    },
    doStream: async (callOptions) => {
      const reply = await answer(callOptions);
      const text =
        'text' in reply ? reply.text : 'object' in reply ? JSON.stringify(reply.object) : '';
      const words = text.split(/(?<= )/);
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 't1' },
            ...words.map((delta) => ({ type: 'text-delta', id: 't1', delta })),
            { type: 'text-end', id: 't1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: undefined },
              usage: usage(10, 5),
            },
          ] as never[],
        }),
      } as never;
    },
  });
}

/** Deterministic vectors: the same text, the same vector. */
export function createMockEmbeddingModel(dimensions: number, calls: string[][]) {
  return new MockEmbeddingModelV4({
    provider: 'test',
    modelId: 'test-embedding',
    doEmbed: async ({ values }) => {
      calls.push([...values]);
      return {
        embeddings: values.map((value) =>
          Array.from({ length: dimensions }, (_, i) => {
            let h = 0;
            for (const ch of `${i}:${value}`) h = (h * 31 + ch.charCodeAt(0)) | 0;
            return (h % 1000) / 1000;
          }),
        ),
        usage: { tokens: values.join(' ').split(/\s+/).length },
        warnings: [],
      } as never;
    },
  });
}

export function mockLanguage(
  model: ReturnType<typeof createMockLanguageModel>,
): ResolvedLanguageModel {
  return {
    model,
    ref: { providerId: 'test', providerName: 'Test provider', modelId: model.modelId },
    capabilities: null,
    defaults: NO_ROLE_DEFAULTS,
  };
}

export function mockEmbedding(
  model: ReturnType<typeof createMockEmbeddingModel>,
): ResolvedEmbeddingModel {
  return {
    model,
    ref: { providerId: 'test', providerName: 'Test provider', modelId: model.modelId },
    capabilities: null,
  };
}
