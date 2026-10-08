import type { FastifyPluginAsync } from 'fastify';
import type { IssuesController } from '../controllers/issues.controller.ts';

/** Mounted at /api/v1/work/issues behind the kernel's module gate. */
export function issuesRoutes(controller: IssuesController): FastifyPluginAsync {
  return async (app) => {
    app.get('/issues', async (request) => controller.list(request));
    app.post('/issues', async (request, reply) => controller.create(request, reply));
    app.get('/issues/:key', async (request) => controller.get(request));
    app.patch('/issues/:key', async (request) => controller.update(request));
    app.delete('/issues/:key', async (request, reply) => controller.remove(request, reply));
    app.post('/issues/:key/restore', async (request) => controller.restore(request));
    app.patch('/issues/:key/rank', async (request) => controller.rank(request));
    app.post('/issues/:key/assign', async (request) => controller.assign(request));
    app.get('/issues/:key/watchers', async (request) => controller.watchers(request));
    app.put('/issues/:key/watchers', async (request, reply) => controller.watch(request, reply));
    app.get('/issues/:key/work-logs', async (request) => controller.workLogs(request));
    app.post('/issues/:key/work-logs', async (request, reply) =>
      controller.addWorkLog(request, reply),
    );
  };
}
