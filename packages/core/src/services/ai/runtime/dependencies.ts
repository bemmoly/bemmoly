import type { AiLanguageRole, AiModelCapabilities, AiRole, AiRunOutcome } from '@bemmoly/shared';
import type { AiPolicy, AiRenderedPrompt } from '../../../contracts/ai.ts';
import type { Actor } from '../../../contracts/authz.ts';

/** One ai_runs row as the facade records it. */
export interface AiRunRecord {
  role: AiRole;
  purpose: string;
  providerId: string | null;
  model: string | null;
  promptId: string | null;
  promptVersion: number | null;
  inputHash: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  outcome: AiRunOutcome;
  error: string | null;
  userId: string | null;
  requestId: string | null;
}

export interface AiRunRecorder {
  /** Stores the row and returns its id. */
  record(run: AiRunRecord): Promise<string>;
}

export interface AiPolicySource {
  policy(actor: Actor | null): Promise<AiPolicy>;
}

export interface AiPromptSource {
  render(id: string, variables: Readonly<Record<string, string>>): Promise<AiRenderedPrompt>;
}

/** Names the redaction middleware replaces when name redaction is on. */
export interface AiNameSource {
  names(): Promise<readonly string[]>;
}

/** What an assignment adds on top of the call's own settings. */
export interface AiRoleDefaults {
  maxOutputTokens: number | null;
  temperature: number | null;
  reasoningEffort: 'low' | 'medium' | 'high' | null;
}

export interface AiRoleInfo {
  role: AiRole;
  capabilities: AiModelCapabilities | null;
  defaults: AiRoleDefaults;
}

/** Timeouts per role: ghost text must answer fast or not at all. */
export const DEFAULT_TIMEOUT_MS: Record<AiLanguageRole | 'embedding', number> = {
  fast: 1_500,
  standard: 60_000,
  strong: 120_000,
  embedding: 30_000,
};

export const NO_ROLE_DEFAULTS: AiRoleDefaults = {
  maxOutputTokens: null,
  temperature: null,
  reasoningEffort: null,
};
