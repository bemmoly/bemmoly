import {
  ForbiddenError,
  NotFoundError,
  type AiFeedback,
  type AiPreferencesBody,
  type AiStatusResponse,
} from '@bemmoly/shared';
import type { AiFacade } from '../../../contracts/ai.ts';
import type { Actor } from '../../../contracts/authz.ts';
import { aiEnabledFor } from '../policy.ts';
import { aiRefusal } from '../refusals.ts';
import { readGhostText, setGhostText, setOptOut } from '../store/preferences.ts';
import { setRunFeedback } from '../store/runs.ts';
import { announceChange, userIdOf, type AiServiceContext } from './context.ts';

function personOf(actor: Actor): string {
  const id = userIdOf(actor);
  if (!id) throw new ForbiddenError('Only a person has AI preferences');
  return id;
}

/** GET /ai/status: what this person's client needs to draw (or hide) AI surfaces. */
export async function getAiStatus(
  ctx: Pick<AiServiceContext, 'sql'>,
  ai: AiFacade,
  actor: Actor,
): Promise<AiStatusResponse> {
  const policy = await ai.policy(actor);
  const userId = userIdOf(actor);
  return {
    enabled: aiEnabledFor(policy),
    optedOut: policy.actorOptedOut,
    optOutAllowed: policy.perUserOptOutAllowed,
    ghostText: userId ? await readGhostText(ctx.sql, userId) : true,
    allowActions: policy.allowActions,
    availableRoles: policy.enabled && !policy.actorOptedOut ? [...policy.availableRoles] : [],
    budgetState: policy.budgetState,
  };
}

/**
 * PUT /ai/preferences: turn AI off (or back on) for oneself, when the admin allows it, and
 * the ghost text switch, which follows the person to every device.
 */
export async function setAiPreferences(
  ctx: AiServiceContext,
  ai: AiFacade,
  actor: Actor,
  body: AiPreferencesBody,
): Promise<AiStatusResponse> {
  const userId = personOf(actor);
  if (body.optedOut !== undefined) {
    const policy = await ai.policy(actor);
    if (body.optedOut && !policy.perUserOptOutAllowed) {
      throw new ForbiddenError('Your admin has not allowed turning AI off per person');
    }
    await setOptOut(ctx.sql, userId, body.optedOut);
    await announceChange(ctx, actor, ['opt_out']);
  }
  if (body.ghostText !== undefined) await setGhostText(ctx.sql, userId, body.ghostText);
  return getAiStatus(ctx, ai, actor);
}

/** PUT /ai/runs/:id/feedback: "Not useful" (or useful) on one of this person's own runs. */
export async function setAiRunFeedback(
  ctx: AiServiceContext,
  actor: Actor,
  runId: string,
  feedback: AiFeedback | null,
): Promise<void> {
  const userId = personOf(actor);
  if (!(await setRunFeedback(ctx.sql, runId, userId, feedback))) {
    throw new NotFoundError('That AI answer was not found');
  }
}

/** Every AI endpoint except Settings › AI refuses cleanly while AI is off. */
export async function assertAiOn(ai: AiFacade, actor: Actor): Promise<void> {
  const policy = await ai.policy(actor);
  if (!policy.enabled) throw aiRefusal('ai_off');
}
