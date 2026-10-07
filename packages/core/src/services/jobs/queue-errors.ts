import type { Logger } from '../../config/logger.ts';

/**
 * Postgres admin_shutdown: the server ended the connection on purpose. A restore does it
 * to every connection when it swaps the database, so it is expected, not an incident.
 */
const ADMIN_SHUTDOWN = '57P01';

/**
 * pg-boss errors. An expected disconnect is a warning that carries only the message and
 * code; the rest of the error object is the whole pg client, which says nothing useful.
 */
export function logQueueError(logger: Pick<Logger, 'warn' | 'error'>, error: unknown): void {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === ADMIN_SHUTDOWN) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn({ err: { message, code } }, 'job queue connection closed by the database');
    return;
  }
  logger.error({ err: error }, 'job queue error');
}
