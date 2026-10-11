import type { AiRole } from '@bemmoly/shared';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import { monthRange } from './runs.ts';

/** Serialises reservations across every process on this database. */
export async function lockBudget(tx: SqlExecutor): Promise<void> {
  await tx`select pg_advisory_xact_lock(hashtextextended('bemmoly.ai.budget', 0))`;
}

export async function purgeExpiredReservations(sql: SqlExecutor): Promise<void> {
  await sql`delete from ai_budget_reservations where expires_at <= now()`;
}

/** This month's recorded spend plus every live reservation, summed exactly in numeric. */
export async function committedInMonth(sql: SqlExecutor): Promise<number> {
  const range = monthRange();
  const [row] = await sql<{ committed: string }[]>`
    select (
      (select coalesce(sum(cost_usd), 0) from ai_runs
        where created_at >= ${range.from}::timestamptz and created_at < ${range.to}::timestamptz)
      + (select coalesce(sum(amount_usd), 0) from ai_budget_reservations
        where expires_at > now())
    )::text as committed`;
  return Number(row?.committed ?? 0);
}

export async function insertReservation(
  sql: SqlExecutor,
  reservation: { role: AiRole; amountUsd: number; ttlMs: number },
): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into ai_budget_reservations (role, amount_usd, expires_at)
    values (${reservation.role}, ${reservation.amountUsd},
      now() + make_interval(secs => ${reservation.ttlMs / 1000}))
    returning id`;
  if (!row) throw new Error('ai_budget_reservations insert returned no row');
  return row.id;
}

export async function deleteReservation(sql: SqlExecutor, id: string): Promise<void> {
  await sql`delete from ai_budget_reservations where id = ${id}`;
}
