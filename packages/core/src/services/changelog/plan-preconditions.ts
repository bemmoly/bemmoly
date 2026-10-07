import type { Precondition, PreconditionCheck } from '../../contracts/changelog.ts';
import type { PlannedSchema } from './plan-schema.ts';
import { describeCheck, holds } from './preconditions.ts';
import type { Connection } from './store.ts';

/** Asks the database whether a check holds today. */
export type Probe = (check: PreconditionCheck) => Promise<boolean>;

export interface PlanPreconditionState {
  schema: PlannedSchema;
  probe: Probe;
  /** Whether a changeset earlier in the same plan would run first. */
  earlierPending: boolean;
}

/** A precondition that does not hold when planned, and whether that answer is final. */
export interface PlanVerdict {
  precondition: Precondition;
  /** Earlier changesets in the plan could change the answer; update checks it again. */
  deferred: boolean;
  error?: string;
}

interface Judgement {
  holds: boolean;
  open: boolean;
  error?: string;
}

async function judge(check: PreconditionCheck, state: PlanPreconditionState): Promise<Judgement> {
  if ('not' in check) {
    const inner = await judge(check.not, state);
    return inner.error ? inner : { ...inner, holds: !inner.holds };
  }
  const simulated = state.schema.answer(check);
  if (simulated !== undefined) return { holds: simulated, open: false };
  // Existence checks the plan does not touch are answered by today's schema.
  // Data checks are not simulated, so earlier changesets may still change them.
  const dataCheck = 'rowCount' in check || 'sqlCheck' in check;
  try {
    return { holds: await state.probe(check), open: dataCheck && state.earlierPending };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { holds: false, open: state.earlierPending, error: message };
  }
}

/**
 * The precondition `db plan` reports, judged against today's schema plus what
 * earlier pending changesets create. A definite failure wins over one that
 * only earlier changesets could settle.
 */
export async function failingInPlan(
  preconditions: readonly Precondition[] | undefined,
  state: PlanPreconditionState,
): Promise<PlanVerdict | undefined> {
  let deferred: PlanVerdict | undefined;
  for (const precondition of preconditions ?? []) {
    const judgement = await judge(precondition, state);
    if (judgement.holds) continue;
    const verdict: PlanVerdict = {
      precondition,
      deferred: judgement.open,
      ...(judgement.error ? { error: judgement.error } : {}),
    };
    if (!verdict.deferred) return verdict;
    deferred ??= verdict;
  }
  return deferred;
}

export function describeVerdict(verdict: PlanVerdict): string {
  const { precondition } = verdict;
  const check = `precondition ${describeCheck(precondition)}`;
  const failed = verdict.error ? `could not be checked (${verdict.error})` : 'does not hold';
  if (!verdict.deferred) return `${check} ${failed}`;
  return (
    `${check} ${failed} yet; earlier changesets in this plan may change that, ` +
    `and update checks it again before running (onFail: ${precondition.onFail})`
  );
}

/**
 * A probe that runs inside the plan's read-only transaction; a savepoint keeps
 * a failing check (a table that does not exist yet) from aborting the plan.
 */
export function savepointProbe(connection: Connection): Probe {
  return async (check) => {
    await connection.unsafe('savepoint plan_precondition');
    try {
      const result = await holds(connection, check);
      await connection.unsafe('release savepoint plan_precondition');
      return result;
    } catch (error) {
      await connection.unsafe('rollback to savepoint plan_precondition');
      throw error;
    }
  };
}
