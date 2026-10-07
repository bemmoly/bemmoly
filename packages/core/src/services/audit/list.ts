import type { AuditEntry, ListAuditLogQuery } from '@bemmoly/shared';
import { and, desc, eq, gte, lt, lte, type SQL } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { auditLog, type AuditLogRow } from '../../models/audit/index.ts';
import { decodeCursor, toPage } from '../../utils/keyset.ts';
import type { RequestContext } from '../authz/index.ts';

export function presentAuditEntry(row: AuditLogRow): AuditEntry {
  return {
    id: row.id,
    actorId: row.actorId,
    actorKind: row.actorKind,
    actorUserId: row.actorUserId,
    action: row.action,
    targetKind: row.targetKind,
    targetId: row.targetId,
    before: row.before ?? null,
    after: row.after ?? null,
    ip: row.ip,
    requestId: row.requestId,
    aiPlanId: row.aiPlanId,
    createdAt: row.createdAt.toISOString(),
  };
}

function filters(query: Omit<ListAuditLogQuery, 'format' | 'limit'>): SQL[] {
  const where: (SQL | undefined)[] = [
    query.action ? eq(auditLog.action, query.action) : undefined,
    query.actorId ? eq(auditLog.actorId, query.actorId) : undefined,
    query.targetKind ? eq(auditLog.targetKind, query.targetKind) : undefined,
    query.targetId ? eq(auditLog.targetId, query.targetId) : undefined,
    query.since ? gte(auditLog.createdAt, new Date(query.since)) : undefined,
    query.until ? lte(auditLog.createdAt, new Date(query.until)) : undefined,
  ];
  const cursor = decodeCursor(query.cursor);
  if (cursor) where.push(lt(auditLog.id, cursor));
  return where.filter((clause): clause is SQL => clause !== undefined);
}

/** Newest first, keyset paginated on the time-ordered id. */
export async function listAuditLog(
  db: Database,
  ctx: RequestContext,
  query: ListAuditLogQuery,
): Promise<{ items: AuditEntry[]; nextCursor: string | null }> {
  await ctx.authz.authorize(ctx.actor, 'workspace.audit.view', { kind: 'workspace' });
  const rows = await db
    .select()
    .from(auditLog)
    .where(and(...filters(query)))
    .orderBy(desc(auditLog.id))
    .limit(query.limit + 1);
  const page = toPage(rows, query.limit);
  return { items: page.rows.map(presentAuditEntry), nextCursor: page.nextCursor };
}

const EXPORT_BATCH = 1000;
/** A ceiling so one export cannot hold a connection for minutes; filter by date for more. */
export const EXPORT_MAX_ROWS = 100_000;

/** Every matching row, newest first, in batches; used by the CSV export. */
export async function* iterateAuditLog(
  db: Database,
  ctx: RequestContext,
  query: ListAuditLogQuery,
): AsyncGenerator<AuditEntry> {
  await ctx.authz.authorize(ctx.actor, 'workspace.audit.view', { kind: 'workspace' });
  let cursor = query.cursor;
  let emitted = 0;
  while (emitted < EXPORT_MAX_ROWS) {
    const page = await listAuditLog(db, ctx, { ...query, cursor, limit: EXPORT_BATCH });
    for (const item of page.items) yield item;
    emitted += page.items.length;
    if (!page.nextCursor) return;
    cursor = page.nextCursor;
  }
}
