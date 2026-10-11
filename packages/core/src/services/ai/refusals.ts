import { ForbiddenError, type AiRefusalReason, type AiRole } from '@bemmoly/shared';
import type { AiFacade, AiPolicy } from '../../contracts/ai.ts';

const MESSAGES: Record<AiRefusalReason, string> = {
  ai_off: 'AI is turned off for this workspace',
  role_unset: 'No model is set for this kind of AI task yet',
  budget_reached: "This month's AI budget is spent; it resets on the 1st",
  opted_out: 'You turned AI off for yourself',
  excluded: 'This content is excluded from AI',
  actions_off: 'AI actions that change data are turned off',
};

/** The typed refusal every AI entry point throws before reaching a provider. */
export function aiRefusal(reason: AiRefusalReason, role?: AiRole): ForbiddenError {
  const message =
    reason === 'role_unset' && role
      ? `No model is set for the ${role} AI role yet`
      : MESSAGES[reason];
  return new ForbiddenError(message, { details: role ? { reason, role } : { reason } });
}

export function isAiRefusal(error: unknown): error is ForbiddenError {
  if (!(error instanceof ForbiddenError)) return false;
  const details = error.details as { reason?: unknown } | undefined;
  return typeof details?.reason === 'string';
}

/** The policy of an install without AI: off, nothing available. */
export const OFF_POLICY: AiPolicy = {
  enabled: false,
  shareContent: false,
  redactEmails: false,
  redactNames: false,
  excludedSpaceIds: [],
  excludedProjectIds: [],
  allowActions: false,
  perUserOptOutAllowed: false,
  optedOutUserIds: [],
  actorOptedOut: false,
  budgetState: 'unlimited',
  assignedRoles: [],
  availableRoles: [],
};

/** A facade that refuses everything cleanly: no database, or AI not wired in this process. */
export function createDisabledAi(): AiFacade {
  const off = async (): Promise<never> => {
    throw aiRefusal('ai_off');
  };
  return {
    generate: off,
    stream: off,
    embed: off,
    renderPrompt: off,
    enabled: async () => false,
    policy: async () => OFF_POLICY,
    assertAvailable: off,
    maySend: async () => false,
    embeddingModel: async () => null,
  };
}
