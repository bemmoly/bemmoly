import type { FastifyPluginAsync } from 'fastify';
import type { AuditController } from '../controllers/audit.controller.ts';

export function auditRoutes(controller: AuditController): FastifyPluginAsync {
  return async (app) => {
    app.get('/audit-log', async (req, reply) => controller.list(req, reply));
  };
}
