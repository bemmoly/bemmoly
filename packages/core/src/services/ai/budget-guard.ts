import type { SqlClient } from '../../clients/postgres.ts';
import type { SettingsService } from '../../contracts/settings.ts';
import { budgetStatusOf } from './policy.ts';
import { aiRefusal } from './refusals.ts';
import type { AiBudgetGuard } from './runtime/dependencies.ts';
import {
  committedInMonth,
  deleteReservation,
  insertReservation,
  lockBudget,
  purgeExpiredReservations,
} from './store/reservations.ts';
import { monthRange } from './store/runs.ts';

export interface DbBudgetGuardDeps {
  sql: SqlClient;
  settings: SettingsService;
}

/**
 * The budget check that holds under concurrency: one short transaction under an advisory lock
 * reads this month's spend plus live reservations, uncached, and either refuses or reserves
 * the call's estimate. Every process shares the lock and the table, so N calls racing at the
 * limit pass one at a time and the ones after the limit is committed are refused.
 */
export function createDbBudgetGuard(deps: DbBudgetGuardDeps): AiBudgetGuard {
  return {
    async reserve({ role, estimateUsd, ttlMs }) {
      const budgetUsd = await deps.settings.get('ai.monthlyBudgetUsd');
      if (budgetUsd === null) return null;
      const id = await deps.sql.begin(async (tx) => {
        await lockBudget(tx);
        await purgeExpiredReservations(tx);
        const committed = await committedInMonth(tx);
        // The same threshold as the policy: at or over the budget pauses.
        const status = budgetStatusOf(committed, budgetUsd, monthRange().label);
        if (status.state === 'paused') return null;
        return insertReservation(tx, { role, amountUsd: estimateUsd, ttlMs });
      });
      if (id === null) throw aiRefusal('budget_reached', role);
      return { release: () => deleteReservation(deps.sql, id) };
    },
  };
}
