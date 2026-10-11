import type { AiServiceContext } from './admin/context.ts';

/** Published once per month and state when spend crosses 80% (warning) and 100% (paused). */
export const AI_BUDGET_THRESHOLD = 'ai.budget.threshold';

export interface AiBudgetThresholdPayload {
  month: string;
  state: 'warning' | 'paused';
  spentUsd: number;
  budgetUsd: number;
}

const SYSTEM = { kind: 'system' as const, id: 'ai-budget' };

/**
 * Watches spend after costly runs. Crossing a threshold tells admins once (the inbox listens
 * for AI_BUDGET_THRESHOLD) and drops the policy cache so standard and strong pause at once.
 * The last state told is kept in settings, so replicas and restarts do not repeat it.
 */
export function watchBudget(ctx: AiServiceContext): { check(): void } {
  let running: Promise<void> | null = null;

  async function check(): Promise<void> {
    const status = await ctx.policy.budget();
    if (status.state !== 'warning' && status.state !== 'paused') return;
    const marker = `${status.month}:${status.state}`;
    const told = await ctx.settings.get('ai.budgetNotified');
    if (told === marker || (told === `${status.month}:paused` && status.state === 'warning'))
      return;
    await ctx.settings.set('ai.budgetNotified', marker, SYSTEM);
    ctx.policy.invalidate();
    const payload: AiBudgetThresholdPayload = {
      month: status.month,
      state: status.state,
      spentUsd: status.spentUsd,
      budgetUsd: status.budgetUsd ?? 0,
    };
    await ctx.events?.publish({ kind: AI_BUDGET_THRESHOLD, occurredAt: new Date(), payload });
    await ctx.realtime?.publish({ kind: AI_BUDGET_THRESHOLD, ids: [marker] });
  }

  return {
    check() {
      running ??= check()
        .catch(() => undefined)
        .finally(() => {
          running = null;
        });
    },
  };
}
