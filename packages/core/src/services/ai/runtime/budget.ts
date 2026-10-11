import { AI_BUDGET_PAUSED_ROLES, type AiModelCapabilities, type AiRole } from '@bemmoly/shared';
import type { AiMessage } from '../../../contracts/ai.ts';
import type { AiBudgetGuard, AiBudgetReservation } from './dependencies.ts';
import { costOf } from './gate.ts';
import { estimateTokens, inputCharsOf } from './middleware/usage.ts';

/** The output an estimate assumes when neither the call nor its role caps it. */
export const UNCAPPED_OUTPUT_TOKENS = 4_096;

/** How long a hold outlives its call's timeout before it stops counting unreleased. */
const RESERVATION_MARGIN_MS = 60_000;

interface EstimatedCall {
  system?: string | undefined;
  prompt?: string | undefined;
  messages?: readonly AiMessage[] | undefined;
  maxSteps?: number | undefined;
}

/**
 * What a call may cost before it runs, from the role's catalog prices: input from its
 * characters, output at its cap, every step of a tool loop. A model without prices costs 0
 * when it runs, so it estimates 0 too.
 */
export function estimateCallUsd(
  capabilities: AiModelCapabilities | null,
  call: EstimatedCall,
  maxOutputTokens: number | null,
): number {
  if (!capabilities?.cost) return 0;
  const steps = Math.max(1, call.maxSteps ?? 1);
  const output =
    maxOutputTokens ?? Math.min(capabilities.maxOutput ?? Infinity, UNCAPPED_OUTPUT_TOKENS);
  return costOf(capabilities, {
    inputTokens: estimateTokens(inputCharsOf(call)) * steps,
    outputTokens: output * steps,
  });
}

/** Reserves budget for a role the budget pauses; others, or no guard, hold nothing. */
export async function reserveBudget(
  guard: AiBudgetGuard | undefined,
  role: AiRole,
  estimateUsd: number,
  timeoutMs: number,
): Promise<AiBudgetReservation | null> {
  if (!guard || !(AI_BUDGET_PAUSED_ROLES as readonly AiRole[]).includes(role)) return null;
  // A repaired call runs twice, each under its own timeout.
  return guard.reserve({ role, estimateUsd, ttlMs: 2 * timeoutMs + RESERVATION_MARGIN_MS });
}
