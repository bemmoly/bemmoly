import type { FastifyPluginAsync } from 'fastify';
import type { EnvironmentsV2Controller } from '../controllers/environments-v2.controller.ts';
import type { SetupChecklistController } from '../controllers/setup-checklist.controller.ts';

/** Equal environments, the setup checklist and Start over, under /api/v1/pipelines. */
export function environmentsV2Routes(
  environments: EnvironmentsV2Controller,
  setup: SetupChecklistController,
): FastifyPluginAsync {
  return async (app) => {
    app.get('/environments-v2', async (request) => environments.list(request));
    app.post('/environments-v2', async (request, reply) => environments.create(request, reply));
    app.post('/environments-v2/suggested', async (request, reply) =>
      environments.applySuggested(request, reply),
    );
    app.put('/environments-v2/order', async (request) => environments.reorder(request));
    app.patch('/environments-v2/:key', async (request) => environments.update(request));
    app.delete('/environments-v2/:key', async (request, reply) =>
      environments.remove(request, reply),
    );
    app.get('/setup/checklist', async (request) => setup.checklist(request));
    app.post('/setup/reset', async (request) => setup.startOver(request));
  };
}
