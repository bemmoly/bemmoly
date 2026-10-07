import { MaintenanceError } from '@bemmoly/shared';
import type { onRequestAsyncHookHandler } from 'fastify';
import { renderMaintenancePage, type MaintenanceState } from '../services/system/index.ts';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const RETRY_AFTER_SECONDS = 10;
const ALWAYS_OPEN = ['/healthz', '/readyz', '/api/v1/admin/system', '/api/v1/admin/updates'];

/**
 * While a restore, update or rollback runs: API writes get 503 `maintenance`, browser
 * navigations get the maintenance page, reads and health probes keep working. Register
 * it at the root of the app so the page also covers the web shell's routes.
 */
export function maintenanceHook(
  read: () => Promise<MaintenanceState | null>,
): onRequestAsyncHookHandler {
  return async (request, reply) => {
    const state = await read();
    if (!state) return;
    const path = request.url.split('?')[0] ?? '';
    if (ALWAYS_OPEN.some((open) => path === open || path.startsWith(`${open}/`))) return;
    const api = path.startsWith('/api/');
    if (api && READ_METHODS.has(request.method)) return;
    // API writes get the shared error body from the one error handler.
    if (api) throw new MaintenanceError(state.message, { retryAfterSeconds: RETRY_AFTER_SECONDS });
    reply.code(503).header('retry-after', String(RETRY_AFTER_SECONDS));
    await reply.type('text/html; charset=utf-8').send(renderMaintenancePage(state));
  };
}
