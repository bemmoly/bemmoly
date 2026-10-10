import type { AiLanguageRole } from '@bemmoly/shared';
import {
  embedMany,
  generateText,
  isStepCount,
  Output,
  streamText,
  tool,
  wrapLanguageModel,
  type ModelMessage,
  type ToolSet,
} from 'ai';
import type {
  AiEmbedInput,
  AiEmbedResult,
  AiFacade,
  AiGenerateInput,
  AiGenerateResult,
  AiStreamResult,
} from '../../../contracts/ai.ts';
import { aiRefusal } from '../refusals.ts';
import {
  DEFAULT_TIMEOUT_MS,
  type AiNameSource,
  type AiPolicySource,
  type AiPromptSource,
  type AiRunRecorder,
} from './dependencies.ts';
import { assertRoleAvailable, maySendUnder } from './gate.ts';
import { createRedaction } from './middleware/redaction.ts';
import { createRunLog, type RunLog } from './middleware/usage.ts';
import { isRepairable, repairMessages } from './middleware/repair.ts';
import type { AiModelSource, ResolvedLanguageModel } from './registry.ts';

export interface AiFacadeDependencies {
  models: AiModelSource;
  policy: AiPolicySource;
  runs: AiRunRecorder;
  prompts: AiPromptSource;
  names?: AiNameSource;
  /** SDK-level retries on rate limits, timeouts and 5xx (with the provider's retry-after). */
  maxRetries?: number;
}

type AnyInput = AiGenerateInput<unknown>;

function messagesOf(input: AnyInput): ModelMessage[] {
  const turns: ModelMessage[] = (input.messages ?? []).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  if (input.prompt !== undefined) turns.push({ role: 'user', content: input.prompt });
  return turns;
}

function toolsOf(input: AnyInput): ToolSet | undefined {
  if (!input.tools) return undefined;
  const set: ToolSet = {};
  for (const [name, def] of Object.entries(input.tools)) {
    set[name] = tool({
      description: def.description,
      inputSchema: def.inputSchema as never,
      ...(def.execute
        ? {
            execute: (args: unknown, options: { abortSignal?: AbortSignal }) =>
              def.execute!(args as never, { signal: options.abortSignal }),
          }
        : {}),
    } as never);
  }
  return set;
}

function signalOf(input: AnyInput | AiEmbedInput, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
}

/** Builds the facade over its sources; the server binds the database-backed ones. */
export function createAiFacade(deps: AiFacadeDependencies): AiFacade {
  const maxRetries = deps.maxRetries ?? 2;

  async function prepare(input: AnyInput) {
    const actor = input.actor ?? null;
    const policy = await deps.policy.policy(actor);
    assertRoleAvailable(policy, input.role);
    const resolved = await deps.models.language(input.role as AiLanguageRole);
    if (!resolved) throw aiRefusal('role_unset', input.role);
    const names = policy.redactNames && deps.names ? await deps.names.names() : [];
    const redaction = createRedaction({ emails: policy.redactEmails, names });
    const model = wrapLanguageModel({
      model: resolved.model,
      middleware: [redaction.middleware],
    });
    const log = createRunLog(deps.runs, input, resolved);
    return { resolved, model, log };
  }

  function callSettings(input: AnyInput, resolved: ResolvedLanguageModel) {
    const maxOutputTokens = input.maxOutputTokens ?? resolved.defaults.maxOutputTokens;
    const temperature = input.temperature ?? resolved.defaults.temperature;
    return {
      ...(input.system !== undefined ? { system: input.system } : {}),
      ...(maxOutputTokens !== null ? { maxOutputTokens } : {}),
      ...(temperature !== null && resolved.capabilities?.temperature !== false
        ? { temperature }
        : {}),
      maxRetries,
      stopWhen: isStepCount(Math.max(1, input.maxSteps ?? 1)),
    };
  }

  async function runGenerate(
    input: AnyInput,
    prepared: Awaited<ReturnType<typeof prepare>>,
    messages: ModelMessage[],
  ) {
    const { resolved, model } = prepared;
    const tools = toolsOf(input);
    return generateText({
      model,
      messages,
      ...callSettings(input, resolved),
      ...(tools ? { tools } : {}),
      ...(input.schema ? { output: Output.object({ schema: input.schema as never }) } : {}),
      abortSignal: signalOf(input, input.timeoutMs ?? DEFAULT_TIMEOUT_MS[input.role]),
    });
  }

  async function generate<O>(raw: AiGenerateInput<O>): Promise<AiGenerateResult<O>> {
    const input = raw as AnyInput;
    const prepared = await prepare(input);
    const { log } = prepared;
    let messages = messagesOf(input);
    let repaired = false;
    try {
      let result;
      try {
        result = await runGenerate(input, prepared, messages);
      } catch (error) {
        if (!input.schema || !isRepairable(error)) throw error;
        messages = repairMessages(messages, error);
        repaired = true;
        result = await runGenerate(input, prepared, messages);
      }
      return (await log.success(
        result,
        repaired,
        input.schema ? result.output : undefined,
      )) as never;
    } catch (error) {
      throw await log.failure(error, input.signal, repaired);
    }
  }

  async function stream<O>(raw: AiGenerateInput<O>): Promise<AiStreamResult<O>> {
    const input = raw as AnyInput;
    const prepared = await prepare(input);
    const { resolved, model, log } = prepared;
    const tools = toolsOf(input);
    let streamError: unknown;
    const result = streamText({
      model,
      messages: messagesOf(input),
      ...callSettings(input, resolved),
      ...(tools ? { tools } : {}),
      ...(input.schema ? { output: Output.object({ schema: input.schema as never }) } : {}),
      abortSignal: signalOf(input, input.timeoutMs ?? DEFAULT_TIMEOUT_MS[input.role]),
      onError: ({ error }) => {
        streamError = error;
      },
    });
    const settled = (async () => {
      try {
        const [text, toolCalls, toolResults, finishReason, totalUsage] = await Promise.all([
          result.text,
          result.toolCalls,
          result.toolResults,
          result.finishReason,
          result.totalUsage,
        ]);
        if (streamError) throw streamError;
        const output = input.schema ? await result.output : undefined;
        return log.success(
          { text, toolCalls, toolResults, finishReason, totalUsage },
          false,
          output,
        );
      } catch (error) {
        throw await log.failure(streamError ?? error, input.signal, false);
      }
    })();
    // The caller may only read the stream; the result still settles and records the run.
    settled.catch(() => undefined);
    return { textStream: result.textStream, result: settled as never };
  }

  async function embed(input: AiEmbedInput): Promise<AiEmbedResult> {
    const actor = input.actor ?? null;
    const policy = await deps.policy.policy(actor);
    assertRoleAvailable(policy, 'embedding');
    const resolved = await deps.models.embedding();
    if (!resolved) throw aiRefusal('role_unset', 'embedding');
    const log: RunLog = createRunLog(deps.runs, { ...input, role: 'embedding' }, resolved);
    try {
      const result = await embedMany({
        model: resolved.model,
        values: [...input.values],
        maxRetries,
        abortSignal: signalOf(input, DEFAULT_TIMEOUT_MS.embedding),
      });
      return await log.embedded(result.embeddings, result.usage.tokens ?? 0);
    } catch (error) {
      throw await log.failure(error, input.signal, false);
    }
  }

  return {
    generate,
    stream,
    embed,
    renderPrompt: (id, variables) => deps.prompts.render(id, variables),
    enabled: async (actor) => {
      const policy = await deps.policy.policy(actor ?? null);
      return policy.enabled && !policy.actorOptedOut;
    },
    policy: (actor) => deps.policy.policy(actor ?? null),
    assertAvailable: async (role, actor) => {
      assertRoleAvailable(await deps.policy.policy(actor ?? null), role);
    },
    maySend: async (scope, actor) => maySendUnder(await deps.policy.policy(actor ?? null), scope),
  };
}
