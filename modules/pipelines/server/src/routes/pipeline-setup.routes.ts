import type { FastifyPluginAsync } from 'fastify';
import type { PipelineSetupController } from '../controllers/pipeline-setup.controller.ts';

/** Pipeline setup and built-in templates under /api/v1/pipelines. */
export function pipelineSetupRoutes(controller: PipelineSetupController): FastifyPluginAsync {
  return async (app) => {
    app.get('/applications/:key/pipeline-setup', async (request) => controller.get(request));
    app.put('/applications/:key/pipeline-setup', async (request) => controller.save(request));
    app.get('/applications/:key/pipeline-setup/repository-files', async (request) =>
      controller.repositoryFiles(request),
    );
    app.put('/applications/:key/pipeline-definition', async (request) =>
      controller.saveDefinition(request),
    );
    app.get('/templates/built-in', async (request) => controller.builtInTemplates(request));
  };
}
