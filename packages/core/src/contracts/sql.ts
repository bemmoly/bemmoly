import type postgres from 'postgres';

/**
 * A pooled client or an open transaction. Services that write accept one so a
 * caller can make the write part of its own transaction (outbox rows, inbox rows).
 */
export type SqlExecutor = postgres.ISql;

/**
 * A parameterised piece of SQL built with the client's tagged template, nested
 * into a larger statement at execution time. Modules compile queries to these
 * so values always travel as parameters.
 */
export type SqlFragment = postgres.Fragment;
