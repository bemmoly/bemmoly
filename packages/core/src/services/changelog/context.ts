import type { SQL } from 'drizzle-orm';
import type { BackfillRow, ChangesetContext } from '../../contracts/changelog.ts';
import { formatForPlan, quoteTable, run } from './render.ts';
import { saveProgress, type Connection } from './store.ts';

export interface ChangelogLogger {
  info(details: Record<string, unknown>, message: string): void;
  warn(details: Record<string, unknown>, message: string): void;
}

interface ContextBase {
  connection: Connection;
  key: { module: string; id: string };
  services: Readonly<Record<string, unknown>>;
  logger: ChangelogLogger;
}

export interface ExecuteContextOptions extends ContextBase {
  /** Progress recorded by an earlier, interrupted attempt. */
  progress: Record<string, unknown>;
}

interface BackfillProgress {
  lastId: string | null;
  rows: number;
}

function readProgress(progress: Record<string, unknown>, key: string): BackfillProgress {
  const saved = progress[key] as Partial<BackfillProgress> | undefined;
  return { lastId: saved?.lastId ?? null, rows: saved?.rows ?? 0 };
}

/** The context `up` and `down` receive when they really run. */
export function createExecuteContext(options: ExecuteContextOptions): ChangesetContext {
  const { connection, key, logger } = options;
  const progress = { ...options.progress };
  let backfillCalls = 0;
  return {
    async exec(statement: SQL) {
      await run(connection, statement);
    },
    query: <Row extends Record<string, unknown>>(statement: SQL) => run<Row>(connection, statement),
    async backfill<Row extends BackfillRow>(
      table: string,
      { batch }: { batch: number },
      handle: (rows: Row[]) => Promise<void>,
    ) {
      if (!Number.isInteger(batch) || batch < 1) throw new TypeError('backfill batch must be >= 1');
      const progressKey = `${backfillCalls++}:${table}`;
      const state = readProgress(progress, progressKey);
      const from = quoteTable(table);
      if (state.rows > 0) logger.info({ ...key, table, ...state }, 'resuming backfill');
      for (;;) {
        const rows = (await (state.lastId === null
          ? connection.unsafe(`select * from ${from} order by id limit ${batch}`)
          : connection.unsafe(`select * from ${from} where id > $1 order by id limit ${batch}`, [
              state.lastId,
            ]))) as unknown as Row[];
        if (rows.length === 0) break;
        await handle(rows);
        state.lastId = String(rows[rows.length - 1]?.id);
        state.rows += rows.length;
        progress[progressKey] = { ...state };
        await saveProgress(connection, key, progress);
        logger.info({ ...key, table, rows: state.rows }, 'backfill progress');
        if (rows.length < batch) break;
      }
    },
    services: options.services,
    log: (message: string) => logger.info(key, message),
  };
}

export interface PlanContextOptions extends ContextBase {
  statements: string[];
}

/**
 * The context `db plan` uses: statements are captured, not run. Reads run in
 * a read-only transaction the caller opened, and come back empty when the
 * table they need would only exist after an earlier pending changeset.
 */
export function createPlanContext(options: PlanContextOptions): ChangesetContext {
  const { connection, statements, key, logger } = options;
  return {
    async exec(statement: SQL) {
      statements.push(formatForPlan(statement));
    },
    async query<Row extends Record<string, unknown>>(statement: SQL) {
      try {
        await connection.unsafe('savepoint plan_query');
        const rows = await run<Row>(connection, statement);
        await connection.unsafe('release savepoint plan_query');
        return rows;
      } catch {
        await connection.unsafe('rollback to savepoint plan_query');
        return [];
      }
    },
    async backfill(table: string, { batch }: { batch: number }) {
      statements.push(`-- backfill ${table} in batches of ${batch} (code; runs on update)`);
    },
    services: options.services,
    log: (message: string) => logger.info(key, message),
  };
}
