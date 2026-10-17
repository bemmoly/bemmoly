import type { FastifyPluginAsync } from 'fastify';
import type { CiController } from '../controllers/ci.controller.ts';

/** Bring your CI under /api/v1/pipelines. */
export function ciRoutes(controller: CiController): FastifyPluginAsync {
  return async (app) => {
    // Anonymous to the kernel by design: a CI system signs in with its own OIDC token or a CI
    // token, which the controller verifies. A person's session or Bemmoly token still works.
    app.post('/releases', { config: { anonymous: true } }, async (request, reply) =>
      controller.registerRelease(request, reply),
    );
    app.get('/ci/issuers', async (request) => controller.issuers(request));
    app.post('/ci/issuers', async (request, reply) => controller.createIssuer(request, reply));
    app.delete('/ci/issuers/:id', async (request, reply) =>
      controller.removeIssuer(request, reply),
    );
    app.get('/ci/trust-rules', async (request) => controller.rules(request));
    app.post('/ci/trust-rules', async (request, reply) => controller.createRule(request, reply));
    app.delete('/ci/trust-rules/:id', async (request, reply) =>
      controller.removeRule(request, reply),
    );
    app.get('/ci/tokens', async (request) => controller.tokens(request));
    app.post('/ci/tokens', async (request, reply) => controller.createToken(request, reply));
    app.delete('/ci/tokens/:id', async (request, reply) => controller.revokeToken(request, reply));
    app.get('/ci/checks', async (request) => controller.checks(request));
  };
}
