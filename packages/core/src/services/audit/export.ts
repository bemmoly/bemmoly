import type { ListAuditLogQuery } from '@bemmoly/shared';
import type { Database } from '../../clients/drizzle.ts';
import type { RequestContext } from '../authz/index.ts';
import { auditLogToCsv } from './csv.ts';
import { iterateAuditLog } from './list.ts';

/**
 * Authorizes before the first byte, so a refusal is a clean 403 rather than a
 * broken download, then streams the matching rows as CSV.
 */
export async function exportAuditLog(
  db: Database,
  ctx: RequestContext,
  query: ListAuditLogQuery,
): Promise<AsyncGenerator<string>> {
  await ctx.authz.authorize(ctx.actor, 'workspace.audit.view', { kind: 'workspace' });
  return auditLogToCsv(iterateAuditLog(db, ctx, query));
}
