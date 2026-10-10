import type { AiFeedback, AiUsageBucket } from '@bemmoly/shared';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import type { AiRunRecord } from '../runtime/dependencies.ts';

export async function insertRun(sql: SqlExecutor, run: AiRunRecord): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into ai_runs (role, purpose, provider_id, model, prompt_id, prompt_version, input_hash,
      input_tokens, output_tokens, cost_usd, latency_ms, outcome, error, user_id, request_id)
    values (${run.role}, ${run.purpose},
      ${run.providerId && /^[0-9a-f-]{36}$/i.test(run.providerId) ? run.providerId : null},
      ${run.model}, ${run.promptId}, ${run.promptVersion}, ${run.inputHash}, ${run.inputTokens},
      ${run.outputTokens}, ${run.costUsd}, ${run.latencyMs}, ${run.outcome}, ${run.error},
      ${run.userId}, ${run.requestId})
    returning id`;
  if (!row) throw new Error('ai_runs insert returned no row');
  return row.id;
}

/** The UTC calendar month as [start, end) ISO strings, and its "YYYY-MM" label. */
export function monthRange(
  month?: string,
  now = new Date(),
): { label: string; from: string; to: string } {
  const [year, index] = month
    ? month.split('-').map(Number)
    : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const from = new Date(Date.UTC(year!, index! - 1, 1));
  const to = new Date(Date.UTC(year!, index!, 1));
  return { label: from.toISOString().slice(0, 7), from: from.toISOString(), to: to.toISOString() };
}

export async function spentInMonth(sql: SqlExecutor, month?: string): Promise<number> {
  const range = monthRange(month);
  const [row] = await sql<{ spent: string }[]>`
    select coalesce(sum(cost_usd), 0)::text as spent from ai_runs
    where created_at >= ${range.from}::timestamptz and created_at < ${range.to}::timestamptz`;
  return Number(row?.spent ?? 0);
}

interface RawBucket {
  key: string | null;
  runs: number;
  input_tokens: string;
  output_tokens: string;
  cost_usd: string;
}

const toBucket = (raw: RawBucket): AiUsageBucket => ({
  key: raw.key ?? 'unknown',
  runs: raw.runs,
  inputTokens: Number(raw.input_tokens),
  outputTokens: Number(raw.output_tokens),
  costUsd: Number(raw.cost_usd),
});

export interface MonthUsage {
  totals: Omit<AiUsageBucket, 'key'>;
  byRole: AiUsageBucket[];
  byPurpose: AiUsageBucket[];
  byModel: AiUsageBucket[];
  failures: number;
  feedback: Record<AiFeedback, number>;
}

export async function usageInMonth(sql: SqlExecutor, month?: string): Promise<MonthUsage> {
  const range = monthRange(month);
  const inMonth = sql`created_at >= ${range.from}::timestamptz and created_at < ${range.to}::timestamptz`;
  const grouped = (column: 'role' | 'purpose' | 'model') => sql<RawBucket[]>`
    select ${sql(column)} as key, count(*)::int as runs, sum(input_tokens)::text as input_tokens,
      sum(output_tokens)::text as output_tokens, sum(cost_usd)::text as cost_usd
    from ai_runs where ${inMonth} group by ${sql(column)} order by sum(cost_usd) desc, 1`;
  const [byRole, byPurpose, byModel, [stats]] = await Promise.all([
    grouped('role'),
    grouped('purpose'),
    grouped('model'),
    sql<
      {
        runs: number;
        input_tokens: string;
        output_tokens: string;
        cost_usd: string;
        failures: number;
        useful: number;
        not_useful: number;
      }[]
    >`
      select count(*)::int as runs, coalesce(sum(input_tokens), 0)::text as input_tokens,
        coalesce(sum(output_tokens), 0)::text as output_tokens,
        coalesce(sum(cost_usd), 0)::text as cost_usd,
        count(*) filter (where outcome not in ('ok', 'repaired'))::int as failures,
        count(*) filter (where feedback = 'useful')::int as useful,
        count(*) filter (where feedback = 'not_useful')::int as not_useful
      from ai_runs where ${inMonth}`,
  ]);
  return {
    totals: {
      runs: stats?.runs ?? 0,
      inputTokens: Number(stats?.input_tokens ?? 0),
      outputTokens: Number(stats?.output_tokens ?? 0),
      costUsd: Number(stats?.cost_usd ?? 0),
    },
    byRole: byRole.map(toBucket),
    byPurpose: byPurpose.map(toBucket),
    byModel: byModel.map(toBucket),
    failures: stats?.failures ?? 0,
    feedback: { useful: stats?.useful ?? 0, not_useful: stats?.not_useful ?? 0 },
  };
}

/** Sets feedback on the person's own run; false when there is no such run of theirs. */
export async function setRunFeedback(
  sql: SqlExecutor,
  id: string,
  userId: string,
  feedback: AiFeedback | null,
): Promise<boolean> {
  const rows = await sql`
    update ai_runs set feedback = ${feedback} where id = ${id} and user_id = ${userId}
    returning id`;
  return rows.length > 0;
}
