import type { FastifyPluginAsync } from 'fastify';
import type { CodeHostsController } from '../controllers/code-hosts.controller.ts';

/** The largest delivery accepted; a host's biggest push payloads stay well under it. */
const WEBHOOK_BODY_LIMIT = 5 * 1024 * 1024;

/**
 * Inbound deliveries from GitHub and GitLab. Anonymous by design: the host signs each body
 * (or sends the secret token), and the controller verifies that over the untouched bytes
 * before anything is parsed, so this scope reads every body as a Buffer. Hosts post
 * cross-site without cookies, so the Origin check does not apply.
 */
function webhookRoutes(c: CodeHostsController): FastifyPluginAsync {
  return async (app) => {
    // JSON included: the signature covers the bytes as sent, so nothing parses them here.
    app.removeAllContentTypeParsers();
    app.addContentTypeParser(
      '*',
      { parseAs: 'buffer', bodyLimit: WEBHOOK_BODY_LIMIT },
      (_request, body, done) => done(null, body),
    );
    app.post(
      '/code-hosts/:id/webhooks',
      { config: { anonymous: true, crossSiteForm: true }, bodyLimit: WEBHOOK_BODY_LIMIT },
      async (r) => c.webhook(r),
    );
  };
}

/** Settings › Integrations › Code hosts under /api/v1/admin, and the webhook endpoint. */
export function codeHostsRoutes(c: CodeHostsController): FastifyPluginAsync {
  return async (app) => {
    await app.register(webhookRoutes(c));
    app.get('/admin/code-hosts', async (r) => c.list(r));
    app.post('/admin/code-hosts', async (r, reply) => c.create(r, reply));
    app.get('/admin/code-hosts/:id', async (r) => c.get(r));
    app.patch('/admin/code-hosts/:id', async (r) => c.update(r));
    app.delete('/admin/code-hosts/:id', async (r, reply) => c.remove(r, reply));
    app.get('/admin/code-hosts/:id/deliveries', async (r) => c.deliveries(r));
    app.post('/admin/code-hosts/:id/tests', async (r, reply) => c.test(r, reply));
    app.post('/admin/code-hosts/:id/backfills', async (r, reply) => c.backfill(r, reply));
    app.post('/admin/code-hosts/github-app-manifests', async (r, reply) =>
      c.startGithubApp(r, reply),
    );
    // Opened by the browser itself (a page, not a JSON call), under the admin's session.
    app.get('/admin/code-hosts/github-app-manifests', async (r, reply) =>
      c.githubAppForm(r, reply),
    );
    app.post('/admin/code-hosts/github-apps', async (r, reply) => c.completeGithubApp(r, reply));
    app.post('/admin/code-hosts/:id/installations', async (r, reply) =>
      c.installGithubApp(r, reply),
    );
  };
}
