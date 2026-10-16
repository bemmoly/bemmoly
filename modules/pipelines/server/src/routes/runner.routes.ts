import type { FastifyPluginAsync } from 'fastify';
import { checkProtocol, type RunnerController } from '../controllers/runner.controller.ts';

/** A job's artifact may be large; everything else a runner sends is small JSON. */
const ARTIFACT_BODY_LIMIT = 100 * 1024 * 1024;
const LOG_BODY_LIMIT = 4 * 1024 * 1024;

/*
 * The runner protocol, mounted at /api/v1/runner. Every route is anonymous to the kernel by
 * design (`config.anonymous`): there is no person behind a runner, and each call is checked
 * against a runner or job token by the service.
 */
export function runnerRoutes(controller: RunnerController): FastifyPluginAsync {
  return async (app) => {
    const open = { config: { anonymous: true } } as const;
    app.addHook('onRequest', async (request) => checkProtocol(request));
    app.addContentTypeParser(
      'application/octet-stream',
      { parseAs: 'buffer', bodyLimit: ARTIFACT_BODY_LIMIT },
      (_request, body, done) => done(null, body),
    );
    app.post('/register', open, async (request, reply) => controller.register(request, reply));
    app.post('/heartbeat', open, async (request) => controller.heartbeat(request));
    app.post('/claims', open, async (request, reply) => controller.claim(request, reply));
    app.post('/jobs/:id/state', open, async (request, reply) =>
      controller.jobState(request, reply),
    );
    app.post('/jobs/:id/steps/:position/state', open, async (request, reply) =>
      controller.stepState(request, reply),
    );
    app.post('/jobs/:id/logs', { ...open, bodyLimit: LOG_BODY_LIMIT }, async (request, reply) =>
      controller.logs(request, reply),
    );
    app.post(
      '/jobs/:id/tests',
      { ...open, bodyLimit: LOG_BODY_LIMIT * 4 },
      async (request, reply) => controller.tests(request, reply),
    );
    app.post('/jobs/:id/splits', open, async (request) => controller.splits(request));
    app.get('/jobs/:id/secrets', open, async (request) => controller.secrets(request));
    app.put(
      '/jobs/:id/artifacts',
      { ...open, bodyLimit: ARTIFACT_BODY_LIMIT },
      async (request, reply) => controller.artifact(request, reply),
    );
    app.post('/jobs/:id/finish', open, async (request, reply) => controller.finish(request, reply));
  };
}
