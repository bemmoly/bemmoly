import type { FastifyInstance } from 'fastify';
import type { DatabaseConnection } from './database.ts';

/** Stops accepting requests, then closes the pool, on SIGINT or SIGTERM. */
export function closeOnSignals(
  app: FastifyInstance,
  database: DatabaseConnection | undefined,
): void {
  app.addHook('onClose', async () => {
    await database?.sql.end({ timeout: 5 });
  });
  const shutdown = (signal: NodeJS.Signals) => {
    app.log.info({ signal }, 'shutting down');
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        app.log.error({ err: error }, 'shutdown failed');
        process.exit(1);
      },
    );
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
