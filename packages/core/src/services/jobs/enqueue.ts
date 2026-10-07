import type { PgBoss, SendOptions } from 'pg-boss';
import type postgres from 'postgres';
import type { SqlClient } from '../../clients/postgres.ts';
import type { EnqueueOptions } from '../../contracts/jobs.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';

/** How long a key used without `singleton` blocks a repeat enqueue. */
export const IDEMPOTENCY_TTL_HOURS = 24;

/** The kernel's own extension: the request id is carried into the handler's logs. */
export interface KernelEnqueueOptions extends EnqueueOptions {
  requestId?: string;
}

/** What a job carries: the caller's payload plus the request id for tracing. */
export interface JobEnvelope {
  payload: unknown;
  requestId?: string;
}

/** pg-boss runs its insert through the caller's connection, inside its transaction. */
function through(executor: SqlExecutor) {
  return {
    async executeSql(text: string, values?: unknown[]) {
      const rows = await executor.unsafe(text, (values ?? []) as postgres.ParameterOrJSON<never>[]);
      return { rows: [...rows] };
    },
  };
}

async function waitingWithKey(tx: SqlExecutor, name: string, key: string): Promise<boolean> {
  // Serialises enqueues of the same (name, key) so two callers cannot both see none waiting.
  await tx`select pg_advisory_xact_lock(hashtextextended(${`${name}:${key}`}, 0))`;
  const rows = await tx`
    select 1 from pgboss.job
    where name = ${name} and singleton_key = ${key} and state in ('created', 'retry')
    limit 1`;
  return rows.length > 0;
}

async function claimKey(tx: SqlExecutor, name: string, key: string): Promise<boolean> {
  const rows = await tx`
    insert into idempotency_keys (scope, key, expires_at)
    values (${`job:${name}`}, ${key}, now() + make_interval(hours => ${IDEMPOTENCY_TTL_HOURS}))
    on conflict (scope, key) do nothing
    returning id`;
  return rows.length > 0;
}

/**
 * enqueue() on pg-boss, honouring the JobQueue contract:
 * - `key` + `singleton`: dropped (null) while a job with that key still waits;
 * - `key` alone: an idempotency key, dropped if used in the last 24 hours;
 * - `transaction`: the job (and the key) exist only if the caller commits.
 * Keyed enqueues without a caller transaction get their own, so the check and
 * the insert are atomic.
 */
export function createEnqueue(sql: SqlClient, boss: PgBoss) {
  return async function enqueue(
    name: string,
    payload: object,
    options: KernelEnqueueOptions = {},
  ): Promise<string | null> {
    const envelope: JobEnvelope = {
      payload,
      ...(options.requestId ? { requestId: options.requestId } : {}),
    };
    const send: SendOptions = {};
    if (options.startAfter !== undefined) {
      send.startAfter =
        options.startAfter instanceof Date ? options.startAfter : Math.max(0, options.startAfter);
    }
    const { key, singleton, transaction } = options;
    if (!key) {
      return boss.send(name, envelope, transaction ? { ...send, db: through(transaction) } : send);
    }
    const keyed = async (tx: SqlExecutor): Promise<string | null> => {
      const duplicate = singleton
        ? await waitingWithKey(tx, name, key)
        : !(await claimKey(tx, name, key));
      if (duplicate) return null;
      return boss.send(name, envelope, { ...send, singletonKey: key, db: through(tx) });
    };
    if (transaction) return keyed(transaction);
    return sql.begin((tx) => keyed(tx));
  };
}
