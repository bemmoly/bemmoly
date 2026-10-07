import type postgres from 'postgres';

/**
 * A pooled client or an open transaction. Services that write accept one so a
 * caller can make the write part of its own transaction (outbox rows, inbox rows).
 */
export type SqlExecutor = postgres.ISql;
