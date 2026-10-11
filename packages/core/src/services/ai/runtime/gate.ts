import { createHash } from 'node:crypto';
import { AI_BUDGET_PAUSED_ROLES, type AiModelCapabilities, type AiRole } from '@bemmoly/shared';
import type { AiContentScope, AiMessage, AiPolicy } from '../../../contracts/ai.ts';
import { aiRefusal } from '../refusals.ts';

/** Throws the refusal a call with this role gets under this policy, or returns. */
export function assertRoleAvailable(policy: AiPolicy, role: AiRole): void {
  if (!policy.enabled) throw aiRefusal('ai_off');
  if (policy.actorOptedOut) throw aiRefusal('opted_out');
  if (policy.availableRoles.includes(role)) return;
  const paused =
    policy.budgetState === 'paused' && (AI_BUDGET_PAUSED_ROLES as readonly AiRole[]).includes(role);
  throw paused ? aiRefusal('budget_reached', role) : aiRefusal('role_unset', role);
}

/** Excluded spaces and projects never leave; opted-out authors' content stays home too. */
export function maySendUnder(policy: AiPolicy, scope: AiContentScope): boolean {
  if (!policy.enabled) return false;
  if (scope.spaceId && policy.excludedSpaceIds.includes(scope.spaceId)) return false;
  if (scope.projectId && policy.excludedProjectIds.includes(scope.projectId)) return false;
  if (scope.authorId && policy.optedOutUserIds.includes(scope.authorId)) return false;
  return true;
}

/** The hash of the rendered input, so a bad output can be reproduced. */
export function inputHashOf(input: {
  role: AiRole;
  purpose: string;
  system?: string | undefined;
  prompt?: string | undefined;
  messages?: readonly AiMessage[] | undefined;
  values?: readonly string[] | undefined;
}): string {
  const canonical = JSON.stringify([
    input.role,
    input.purpose,
    input.system ?? null,
    input.prompt ?? null,
    input.messages ?? null,
    input.values ?? null,
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}

/** USD from the catalog's per-million prices captured on the role; 0 when it has none. */
export function costOf(
  capabilities: AiModelCapabilities | null,
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens?: number },
): number {
  const cost = capabilities?.cost;
  if (!cost) return 0;
  const cached = Math.min(usage.cachedInputTokens ?? 0, usage.inputTokens);
  const fresh = usage.inputTokens - cached;
  const cachedPrice = cost.cacheRead ?? cost.input;
  const usd = (fresh * cost.input + cached * cachedPrice + usage.outputTokens * cost.output) / 1e6;
  return Math.round(usd * 1e6) / 1e6;
}
