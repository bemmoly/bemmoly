import type { FastifyPluginAsync } from 'fastify';
import type { QuarterController } from '../controllers/quarter.controller.ts';

/** A project's progress over one calendar quarter, under /api/v1/work. */
export function quarterRoutes(controller: QuarterController): FastifyPluginAsync {
  return async (app) => {
    app.get('/projects/:key/reports/quarter', async (request) => controller.quarter(request));
  };
}
