import type { AiModelCapabilities, AiRole, AiRunOutcome } from '@bemmoly/shared';
import { ProviderError } from '@bemmoly/shared';
import type {
  AiEmbedResult,
  AiGenerateResult,
  AiMessage,
  AiModelRef,
  AiPromptRef,
  AiToolCall,
  AiToolResult,
} from '../../../../contracts/ai.ts';
import type { Actor } from '../../../../contracts/authz.ts';
import type { AiRunRecorder } from '../dependencies.ts';
import { isAbort, toProviderError } from '../errors.ts';
import { costOf, inputHashOf } from '../gate.ts';

interface LoggedInput {
  role: AiRole;
  purpose: string;
  actor?: Actor | null;
  requestId?: string;
  promptRef?: AiPromptRef;
  system?: string;
  prompt?: string;
  messages?: readonly AiMessage[];
  values?: readonly string[];
}

/** The parts of a generate or stream result the run log reads, by shape. */
interface FinishedCall {
  text: string;
  toolCalls: readonly { toolCallId: string; toolName: string; input: unknown }[];
  toolResults: readonly { toolCallId: string; toolName: string; input: unknown; output: unknown }[];
  finishReason: string;
  totalUsage: {
    inputTokens: number | undefined;
    outputTokens: number | undefined;
    inputTokenDetails?: { cacheReadTokens?: number | undefined };
  };
}

export interface RunLog {
  success(
    call: FinishedCall,
    repaired: boolean,
    object: unknown,
  ): Promise<AiGenerateResult<unknown>>;
  embedded(embeddings: number[][], tokens: number): Promise<AiEmbedResult>;
  /** Records the failed run and returns the error to throw: a ProviderError or the refusal. */
  failure(error: unknown, signal: AbortSignal | undefined, repaired: boolean): Promise<Error>;
}

/** The person behind the call: the user, or whom a token or plan acts for. */
export function actorUserId(actor: Actor | null | undefined): string | null {
  if (!actor) return null;
  return actor.kind === 'user' ? actor.id : (actor.userId ?? null);
}

/**
 * Usage and cost logging plus prompt-version tagging: every call, ok or not, becomes one
 * ai_runs row with the prompt id and version, the input hash, tokens, catalog cost and latency.
 */
export function createRunLog(
  runs: AiRunRecorder,
  input: LoggedInput,
  resolved: { ref: AiModelRef; capabilities: AiModelCapabilities | null },
): RunLog {
  const started = performance.now();
  const base = () => ({
    role: input.role,
    purpose: input.purpose,
    providerId: resolved.ref.providerId,
    model: resolved.ref.modelId,
    promptId: input.promptRef?.id ?? null,
    promptVersion: input.promptRef?.version ?? null,
    inputHash: inputHashOf(input),
    latencyMs: Math.round(performance.now() - started),
    userId: actorUserId(input.actor),
    requestId: input.requestId ?? null,
  });

  return {
    async success(call, repaired, object) {
      const inputTokens = call.totalUsage.inputTokens ?? 0;
      const outputTokens = call.totalUsage.outputTokens ?? 0;
      const cachedInputTokens = call.totalUsage.inputTokenDetails?.cacheReadTokens ?? 0;
      const costUsd = costOf(resolved.capabilities, {
        inputTokens,
        outputTokens,
        cachedInputTokens,
      });
      const outcome: AiRunOutcome = repaired ? 'repaired' : 'ok';
      const runId = await runs.record({
        ...base(),
        inputTokens,
        outputTokens,
        costUsd,
        outcome,
        error: null,
      });
      const toolCalls: AiToolCall[] = call.toolCalls.map(({ toolCallId, toolName, input: i }) => ({
        toolCallId,
        toolName,
        input: i,
      }));
      const toolResults: AiToolResult[] = call.toolResults.map((r) => ({
        toolCallId: r.toolCallId,
        toolName: r.toolName,
        input: r.input,
        output: r.output,
      }));
      return {
        runId,
        text: call.text,
        object: object as never,
        toolCalls,
        toolResults,
        finishReason: call.finishReason,
        usage: { inputTokens, outputTokens, costUsd },
        model: resolved.ref,
        outcome: outcome as 'ok' | 'repaired',
      };
    },
    async embedded(embeddings, tokens) {
      const costUsd = costOf(resolved.capabilities, { inputTokens: tokens, outputTokens: 0 });
      const runId = await runs.record({
        ...base(),
        inputTokens: tokens,
        outputTokens: 0,
        costUsd,
        outcome: 'ok',
        error: null,
      });
      return {
        runId,
        embeddings,
        dimensions: embeddings[0]?.length ?? 0,
        usage: { inputTokens: tokens, outputTokens: 0, costUsd },
        model: resolved.ref,
      };
    },
    async failure(error, signal, repaired) {
      const cancelled = isAbort(error, signal) && Boolean(signal?.aborted);
      const providerError = toProviderError(error, resolved.ref.providerName);
      const failure = (providerError.details as { failure?: string } | undefined)?.failure;
      const outcome: AiRunOutcome = cancelled
        ? 'cancelled'
        : failure === 'timeout'
          ? 'timeout'
          : failure === 'invalid_output' || repaired
            ? 'invalid_output'
            : 'error';
      await runs.record({
        ...base(),
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        outcome,
        error: providerError.message,
      });
      return error instanceof ProviderError ? error : providerError;
    },
  };
}
