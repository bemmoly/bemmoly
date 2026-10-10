import type {
  AiBudgetState,
  AiLanguageRole,
  AiPurpose,
  AiRole,
  AiRunOutcome,
} from '@bemmoly/shared';
import type { z } from 'zod';
import type { Actor } from './authz.ts';

/** One turn of a conversation. Volatile context goes in user turns; `system` stays stable. */
export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * A tool the model may call. Without `execute` the call is only recorded (plan write tools:
 * the model proposes, a person confirms); with it, the result goes back to the model (read
 * tools during planning). Arguments are validated with `inputSchema` either way.
 */
export interface AiTool<Input = unknown> {
  description: string;
  inputSchema: z.ZodType<Input>;
  execute?: (input: Input, options: { signal?: AbortSignal }) => Promise<unknown>;
}

export interface AiToolCall {
  toolCallId: string;
  toolName: string;
  input: unknown;
}

export interface AiToolResult extends AiToolCall {
  output: unknown;
}

/** Which repository prompt produced the input, recorded on ai_runs for reproduction. */
export interface AiPromptRef {
  id: string;
  version: number;
}

export interface AiCallBase {
  purpose: AiPurpose;
  /** The person the call is for: usage, opt-out and audit. Null for system jobs. */
  actor?: Actor | null;
  signal?: AbortSignal;
  /** The request id, for logs and the ai_runs row. */
  requestId?: string;
}

export interface AiGenerateInput<Output = never> extends AiCallBase {
  role: AiLanguageRole;
  /** Stable per purpose (prompt caching works on it). */
  system?: string;
  /** Either a single user prompt or a conversation. */
  prompt?: string;
  messages?: readonly AiMessage[];
  promptRef?: AiPromptRef;
  /** Structured output: the reply is validated, repaired once, then a typed failure. */
  schema?: z.ZodType<Output>;
  tools?: Readonly<Record<string, AiTool<never>>>;
  /** Tool round trips; 1 (the default) means the model's first answer is final. */
  maxSteps?: number;
  maxOutputTokens?: number;
  temperature?: number;
  /** Overrides the default per-call timeout (fast 1.5 s for ghost text, say). */
  timeoutMs?: number;
}

export interface AiCallUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface AiModelRef {
  providerId: string;
  /** The provider's display name, for honest copy. */
  providerName: string;
  modelId: string;
}

export interface AiGenerateResult<Output = never> {
  /** The ai_runs row; feedback ("Not useful") and insights point at it. */
  runId: string;
  text: string;
  /** Present, and validated, when `schema` was given. */
  object: [Output] extends [never] ? undefined : Output;
  toolCalls: readonly AiToolCall[];
  toolResults: readonly AiToolResult[];
  finishReason: string;
  usage: AiCallUsage;
  model: AiModelRef;
  outcome: Extract<AiRunOutcome, 'ok' | 'repaired'>;
}

export interface AiStreamResult<Output = never> {
  /** Text deltas as they arrive. */
  textStream: AsyncIterable<string>;
  /** Settles when the stream ends, with the same shape as generate. */
  result: Promise<AiGenerateResult<Output>>;
}

export interface AiEmbedInput extends AiCallBase {
  values: readonly string[];
}

export interface AiEmbedResult {
  runId: string;
  embeddings: number[][];
  dimensions: number;
  usage: AiCallUsage;
  model: AiModelRef;
}

/** Everything a context builder or feature needs to decide what it may send. */
export interface AiPolicy {
  enabled: boolean;
  shareContent: boolean;
  redactEmails: boolean;
  redactNames: boolean;
  excludedSpaceIds: readonly string[];
  excludedProjectIds: readonly string[];
  allowActions: boolean;
  perUserOptOutAllowed: boolean;
  /** People who opted out: their authored content is sent as titles only. */
  optedOutUserIds: readonly string[];
  /** The actor asked about opted out (always false without one). */
  actorOptedOut: boolean;
  budgetState: AiBudgetState;
  /** Roles with a model assigned, paused or not. */
  assignedRoles: readonly AiRole[];
  /** Assigned and not paused. */
  availableRoles: readonly AiRole[];
}

/** Where content lives, for the exclusion check. */
export interface AiContentScope {
  spaceId?: string | null;
  projectId?: string | null;
  authorId?: string | null;
}

/**
 * The one entry point for model calls, kernel and modules alike (`ctx.ai`). It resolves the
 * role to the assigned model, applies the policy (off, opt-out, budget), redacts, retries,
 * repairs structured output once, and records an ai_runs row with cost. Refusals throw
 * ForbiddenError with `details.reason`; provider failures throw ProviderError.
 */
export interface AiFacade {
  generate<Output = never>(input: AiGenerateInput<Output>): Promise<AiGenerateResult<Output>>;
  stream<Output = never>(input: AiGenerateInput<Output>): Promise<AiStreamResult<Output>>;
  embed(input: AiEmbedInput): Promise<AiEmbedResult>;
  /** AI is on for the workspace (and, given an actor, for that person). */
  enabled(actor?: Actor | null): Promise<boolean>;
  policy(actor?: Actor | null): Promise<AiPolicy>;
  /** Throws the refusal a call with this role would get, without calling a model. */
  assertAvailable(role: AiRole, actor?: Actor | null): Promise<void>;
  /** False when the scope is excluded or its author opted out of others' summaries. */
  maySend(scope: AiContentScope, actor?: Actor | null): Promise<boolean>;
  /** The model the embedding role uses now; null when unset. Detects a model switch. */
  embeddingModel(): Promise<AiModelRef | null>;
  /** Renders a prompt (override first) into system and prompt plus its ref and role. */
  renderPrompt(id: string, variables: Readonly<Record<string, string>>): Promise<AiRenderedPrompt>;
}

export interface AiRenderedPrompt {
  role: AiLanguageRole;
  system: string;
  prompt: string;
  promptRef: AiPromptRef;
  outputSchema: string | null;
}
