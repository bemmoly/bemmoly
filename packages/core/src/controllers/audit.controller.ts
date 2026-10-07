import { Readable } from 'node:stream';
import { listAuditLogQuerySchema, parseOrThrow, type AuditLogPage } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Database } from '../clients/drizzle.ts';
import { exportAuditLog, listAuditLog } from '../services/audit/index.ts';
import { contextOf } from './request-context.ts';

/** The audit log, as JSON pages or one streamed CSV export (`?format=csv`). */
export function createAuditController(db: Database) {
  return {
    async list(request: FastifyRequest, reply: FastifyReply): Promise<AuditLogPage | Readable> {
      const query = parseOrThrow(listAuditLogQuerySchema, request.query);
      const ctx = contextOf(request);
      if (query.format === 'json') return listAuditLog(db, ctx, query);
      const csv = await exportAuditLog(db, ctx, query);
      const stamp = new Date().toISOString().slice(0, 10);
      reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="bemmoly-audit-${stamp}.csv"`)
        .header('cache-control', 'no-store');
      return Readable.from(csv);
    },
  };
}

export type AuditController = ReturnType<typeof createAuditController>;
