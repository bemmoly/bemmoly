import type { FastifyPluginAsync } from 'fastify';
import type { AiController } from '../controllers/ai.controller.ts';

/** A catalog upload is a whole models.dev api.json. */
const CATALOG_BODY_LIMIT = 32 * 1024 * 1024;

/** Settings › AI: admin only (ai.models.configure, checked in the service). */
export function aiAdminRoutes(c: AiController): FastifyPluginAsync {
  return async (app) => {
    app.get('/admin/ai/settings', (r) => c.getSettings(r));
    app.patch('/admin/ai/settings', (r) => c.updateSettings(r));
    app.get('/admin/ai/usage', (r) => c.usage(r));
    app.get('/admin/ai/exclusion-targets', (r) => c.exclusionTargets(r));

    app.get('/admin/ai/providers', (r) => c.listProviders(r));
    app.post('/admin/ai/providers', (r, reply) => c.createProvider(r, reply));
    app.patch('/admin/ai/providers/:id', (r) => c.updateProvider(r));
    app.delete('/admin/ai/providers/:id', (r, reply) => c.deleteProvider(r, reply));
    app.post('/admin/ai/providers/:id/test', (r) => c.testProvider(r));
    app.post('/admin/ai/providers/:id/discover', (r) => c.discoverProvider(r));
    app.post('/admin/ai/provider-tests', (r) => c.testDraft(r));

    app.get('/admin/ai/roles', (r) => c.listRoles(r));
    app.put('/admin/ai/roles/:role', (r) => c.putRole(r));
    app.delete('/admin/ai/roles/:role', (r, reply) => c.deleteRole(r, reply));

    app.get('/admin/ai/catalog', (r) => c.catalog(r));
    app.get('/admin/ai/catalog/providers/:id', (r) => c.catalogProvider(r));
    app.get('/admin/ai/catalog/logos/:id', (r, reply) => c.catalogLogo(r, reply));
    app.post('/admin/ai/catalog-snapshots', { bodyLimit: CATALOG_BODY_LIMIT }, (r, reply) =>
      c.uploadCatalog(r, reply),
    );

    app.get('/admin/ai/prompts', (r) => c.listPrompts(r));
    app.get('/admin/ai/prompts/:id/diff', (r) => c.diffPrompt(r));
    app.put('/admin/ai/prompts/:id/override', (r) => c.overridePrompt(r));
    app.delete('/admin/ai/prompts/:id/override', (r, reply) => c.resetPrompt(r, reply));
  };
}

/** A signed-in person's AI: what to draw, their opt-out, and feedback on an answer. */
export function aiPersonRoutes(c: AiController): FastifyPluginAsync {
  return async (app) => {
    app.get('/ai/status', (r) => c.status(r));
    app.put('/ai/preferences', (r) => c.setPreferences(r));
    app.put('/ai/runs/:id/feedback', (r, reply) => c.setFeedback(r, reply));
  };
}
