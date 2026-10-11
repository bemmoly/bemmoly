import { AsyncLocalStorage } from 'node:async_hooks';
import { UnavailableError } from '@bemmoly/shared';
import type postgres from 'postgres';

/**
 * What the pool does when code holding one of its transactions asks it for a second
 * connection. `throw` refuses (tests, development); `warn` reports it and lets it through.
 */
export type NestedAcquirePolicy = 'throw' | 'warn';

export type PoolEvent =
  | { kind: 'acquire_timeout'; waitedMs: number; statement: string }
  | { kind: 'nested_acquire'; statement: string; stack: string };

export interface PoolGuardOptions {
  /** How long a query or transaction may wait for a free connection; 0 waits forever. */
  acquireTimeoutMs: number;
  nestedAcquire: NestedAcquirePolicy;
  /** Told of every starved wait and every nested acquire, so the host can log them loudly. */
  onEvent?: (event: PoolEvent) => void;
}

/**
 * Thrown when code inside a transaction queries the pool instead of the transaction. The
 * transaction holds one connection while it waits for another; enough of those at once and
 * every connection waits on one that will never come free.
 */
export class NestedPoolAcquireError extends Error {
  override readonly name = 'NestedPoolAcquireError';
}

/** The transaction a stretch of async code runs inside, per pool; scopes nest. */
interface TransactionScope {
  pool: object;
  open: boolean;
  transaction: postgres.TransactionSql | undefined;
  parent: TransactionScope | undefined;
}

const scopes = new AsyncLocalStorage<TransactionScope>();

/** Read through any wrapper (tracing, Drizzle's client) to the pool the guard watches. */
const POOL_IDENTITY = Symbol('bemmoly.pool');

function openScope(pool: object): TransactionScope | undefined {
  for (let scope = scopes.getStore(); scope; scope = scope.parent) {
    if (scope.pool === pool && scope.open) return scope;
  }
  return undefined;
}

function insideTransaction(pool: object): boolean {
  return openScope(pool) !== undefined;
}

/**
 * The transaction the current async context holds on this pool, if any. Read-only lookups
 * deep in the kernel that any transaction may reach (settings, the user directory) run on it
 * rather than asking the pool for a second connection.
 */
export function transactionInScope(pool: postgres.Sql): postgres.TransactionSql | undefined {
  const identity = (pool as unknown as Record<symbol, unknown>)[POOL_IDENTITY];
  return identity ? openScope(identity)?.transaction : undefined;
}

/** postgres.js query internals the guard reads; none are in the published types. */
interface PendingQuery {
  handler: ((query: PendingQuery) => void) & { debug?: unknown };
  state: unknown;
  strings: readonly string[];
  reject: (error: unknown) => void;
  cancel: () => unknown;
}

type AnyFunction = (...args: unknown[]) => unknown;

const MAX_STATEMENT = 200;
const RETRY_AFTER_SECONDS = 5;

const isTemplate = (value: unknown): value is TemplateStringsArray =>
  Array.isArray(value) && 'raw' in value;

const isPending = (value: unknown): value is PendingQuery =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { handler?: unknown }).handler === 'function';

const statementOf = (query: PendingQuery) =>
  query.strings.join('?').replace(/\s+/g, ' ').trim().slice(0, MAX_STATEMENT);

const busyError = (waitedMs: number) =>
  new UnavailableError('Bemmoly is too busy to answer right now. Try again in a moment.', {
    retryAfterSeconds: RETRY_AFTER_SECONDS,
    details: { reason: 'database_pool_exhausted', waitedMs },
  });

function nestedError(statement: string, origin?: string): NestedPoolAcquireError {
  const error = new NestedPoolAcquireError(
    `A query asked the pool for a second connection while its transaction holds one: "${statement}". ` +
      'Run it on the transaction, or move it before or after the transaction.',
  );
  // Point at the code that built the query, not at the driver that ran it.
  if (origin)
    error.stack = `${error.name}: ${error.message}\n${origin.split('\n').slice(1).join('\n')}`;
  return error;
}

/**
 * Wraps the pool so that (1) a wait for a free connection ends after `acquireTimeoutMs` with
 * an UnavailableError (503) instead of hanging the install, and (2) a pool query issued from
 * inside one of the pool's own transactions is refused or reported. Transactions opened on
 * the pool mark their async context; the handles they pass in are not wrapped, so queries on
 * them run untouched.
 */
export function guardPool(sql: postgres.Sql, options: PoolGuardOptions): postgres.Sql {
  const report = (event: PoolEvent) => options.onEvent?.(event);

  /** Returns the error to fail with, or undefined to go ahead. */
  const checkNested = (statement: string, origin?: string): Error | undefined => {
    if (!insideTransaction(sql)) return undefined;
    const error = nestedError(statement, origin);
    report({ kind: 'nested_acquire', statement, stack: error.stack ?? '' });
    return options.nestedAcquire === 'throw' ? error : undefined;
  };

  const watch = <Q>(query: Q): Q => {
    if (!isPending(query)) return query;
    const original = query.handler;
    // Built inside a transaction: keep where, in case it runs there too.
    const origin = insideTransaction(sql) ? new Error().stack : undefined;
    const handler = (pending: PendingQuery) => {
      const statement = statementOf(pending);
      const refused = checkNested(statement, origin);
      if (refused) return pending.reject(refused);
      if (options.acquireTimeoutMs > 0) armAcquireTimeout(pending, statement);
      return original(pending);
    };
    query.handler = Object.assign(handler, { debug: original.debug });
    return query;
  };

  const armAcquireTimeout = (query: PendingQuery, statement: string) => {
    const started = Date.now();
    const timer = setTimeout(() => {
      if (query.state !== null) return;
      const waitedMs = Date.now() - started;
      report({ kind: 'acquire_timeout', waitedMs, statement });
      const reject = query.reject;
      query.reject = () => reject(busyError(waitedMs));
      void query.cancel();
    }, options.acquireTimeoutMs);
    timer.unref();
    const clear = () => clearTimeout(timer);
    Promise.prototype.then.call(query, clear, clear);
  };

  /**
   * Opens a connection-holding scope (a transaction or a reserved connection) with the same
   * acquire timeout. A scope that arrives after its caller gave up is handed straight back.
   */
  const acquireScope = <T>(
    statement: string,
    open: (run: (handle: unknown) => unknown) => Promise<T>,
    work: (handle: unknown) => unknown,
    abandon: (handle: unknown) => unknown,
  ): Promise<T> => {
    const refused = insideTransaction(sql) ? checkNested(statement, new Error().stack) : undefined;
    if (refused) return Promise.reject(refused);
    let phase: 'waiting' | 'started' | 'abandoned' = 'waiting';
    let timer: NodeJS.Timeout | undefined;
    const opened = open((handle) => {
      if (phase === 'abandoned') return abandon(handle);
      phase = 'started';
      clearTimeout(timer);
      return work(handle);
    });
    if (options.acquireTimeoutMs <= 0) return opened;
    const started = Date.now();
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        if (phase !== 'waiting') return;
        phase = 'abandoned';
        const waitedMs = Date.now() - started;
        report({ kind: 'acquire_timeout', waitedMs, statement });
        reject(busyError(waitedMs));
      }, options.acquireTimeoutMs);
      timer.unref();
    });
    opened.then(
      () => clearTimeout(timer),
      () => clearTimeout(timer),
    );
    return Promise.race([opened, timedOut]);
  };

  const begin = (...args: unknown[]) => {
    const fn = args.at(-1) as (tx: unknown) => unknown;
    const mode = args.length > 1 ? (args[0] as string) : '';
    const scope: TransactionScope = {
      pool: sql,
      open: true,
      transaction: undefined,
      parent: scopes.getStore(),
    };
    return acquireScope(
      `begin ${mode}`.trim(),
      (run) => sql.begin(mode, run as (tx: postgres.TransactionSql) => unknown),
      (tx) => {
        const close = () => {
          scope.open = false;
        };
        scope.transaction = tx as postgres.TransactionSql;
        try {
          const result = scopes.run(scope, () => fn(tx));
          const settled = Array.isArray(result) ? Promise.all(result) : Promise.resolve(result);
          return settled.finally(close);
        } catch (error) {
          close();
          throw error;
        }
      },
      () => {
        throw new UnavailableError('The transaction was abandoned while it waited');
      },
    );
  };

  const reserve = () =>
    acquireScope(
      'reserve',
      async (run) => run(await sql.reserve()) as postgres.ReservedSql,
      (reserved) => reserved,
      (reserved) => (reserved as postgres.ReservedSql).release(),
    );

  return new Proxy(sql, {
    apply(target, thisArg, args: unknown[]) {
      const result: unknown = Reflect.apply(target as AnyFunction, thisArg, args);
      return isTemplate(args[0]) ? watch(result) : result;
    },
    get(target, property, receiver) {
      if (property === POOL_IDENTITY) return sql;
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      const method = value as AnyFunction;
      switch (property) {
        case 'unsafe':
        case 'file':
          return (...args: unknown[]) => watch(method.apply(target, args));
        case 'notify':
          return (channel: string, payload: string) =>
            watch(target`select pg_notify(${channel}, ${String(payload)})`);
        case 'begin':
          return begin;
        case 'reserve':
          return reserve;
        default:
          return value;
      }
    },
  });
}
