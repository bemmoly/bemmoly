import { SpanKind, SpanStatusCode, trace, type Tracer } from '@opentelemetry/api';
import type { SqlClient } from '../../clients/index.ts';
import { isTracingEnabled } from './tracing.ts';

const TRACER_NAME = '@bemmoly/core/postgres';
const MAX_QUERY_TEXT = 2_000;

type AnyFunction = (...args: unknown[]) => unknown;
type Then = (onFulfilled?: AnyFunction, onRejected?: AnyFunction) => PromiseLike<unknown>;

export interface InstrumentSqlOptions {
  /** A specific tracer, for tests. Without one, the client is wrapped only while tracing is on. */
  tracer?: Tracer;
}

const isTemplate = (value: unknown): value is TemplateStringsArray =>
  Array.isArray(value) && 'raw' in value;

const isQuery = (value: unknown): value is object & { then: Then } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { then?: unknown }).then === 'function';

/** The statement with placeholders where values go; values themselves are never recorded. */
const templateText = (strings: TemplateStringsArray) =>
  strings.map((part, index) => (index === 0 ? part : `$${index}${part}`)).join('');

const operationOf = (text: string | undefined) =>
  (/^\s*([a-z]+)/i.exec(text ?? '')?.[1] ?? 'QUERY').toUpperCase();

/**
 * postgres.js queries run when first awaited, so the span starts at the first `then`
 * and ends when the query settles. Fragments that are never awaited get no span.
 */
function traceQuery<Q extends object & { then: Then }>(
  query: Q,
  tracer: Tracer,
  text: string | undefined,
): Q {
  const original = query.then;
  let settled: Promise<unknown> | undefined;
  const then: Then = function (this: Q, onFulfilled, onRejected) {
    if (!settled) {
      const operation = operationOf(text);
      const span = tracer.startSpan(operation, {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.system.name': 'postgresql',
          'db.operation.name': operation,
          ...(text ? { 'db.query.text': text.slice(0, MAX_QUERY_TEXT) } : {}),
        },
      });
      settled = Promise.resolve(
        original.call(
          this,
          (rows: unknown) => {
            span.end();
            return rows;
          },
          (error: unknown) => {
            span.recordException(error instanceof Error ? error : String(error));
            span.setStatus({ code: SpanStatusCode.ERROR });
            span.end();
            throw error;
          },
        ),
      );
    }
    return settled.then(onFulfilled, onRejected);
  };
  Object.defineProperty(query, 'then', { value: then, configurable: true, writable: true });
  return query;
}

function wrapCallback(callback: unknown, tracer: Tracer): unknown {
  if (typeof callback !== 'function') return callback;
  return (inner: object, ...rest: unknown[]) =>
    (callback as AnyFunction)(wrapClient(inner, tracer), ...rest);
}

function wrapClient<S extends object>(sql: S, tracer: Tracer): S {
  return new Proxy(sql, {
    apply(target, thisArg, args: unknown[]) {
      const result = Reflect.apply(target as AnyFunction, thisArg, args);
      const [strings] = args;
      return isTemplate(strings) && isQuery(result)
        ? traceQuery(result, tracer, templateText(strings))
        : result;
    },
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      const method = value as AnyFunction;
      switch (property) {
        case 'unsafe':
          return (text: string, params?: unknown[], options?: unknown) => {
            const query = method.call(target, text, params, options);
            if (!isQuery(query)) return query;
            return traceQuery(query, tracer, params && params.length > 0 ? text : undefined);
          };
        case 'begin':
        case 'savepoint':
          return (...args: unknown[]) =>
            method.apply(
              target,
              args.map((arg) => wrapCallback(arg, tracer)),
            );
        case 'reserve':
          return async (...args: unknown[]) =>
            wrapClient((await method.apply(target, args)) as object, tracer);
        default:
          return value;
      }
    },
  });
}

/**
 * Adds a client span per postgres.js query: tagged templates, `unsafe` (which the ORM
 * uses), transactions, savepoints and reserved connections. Returns the client
 * untouched while tracing is off, so the default install pays nothing.
 */
export function instrumentSqlClient(sql: SqlClient, options: InstrumentSqlOptions = {}): SqlClient {
  if (!options.tracer && !isTracingEnabled()) return sql;
  return wrapClient(sql, options.tracer ?? trace.getTracer(TRACER_NAME));
}
