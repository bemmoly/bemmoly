import type { FastifyPluginAsync } from 'fastify';
import type { SsoAdminController } from '../controllers/sso-admin.controller.ts';
import type { SsoController } from '../controllers/sso.controller.ts';

const ANONYMOUS = { config: { anonymous: true } } as const;
/** A SAML response is a form POST; nothing else under the SSO routes takes a form. */
const SAML_BODY_LIMIT = 1024 * 1024;

/**
 * Single sign-on. The browser routes are anonymous by design (they run before anyone is
 * signed in) and fall under the strict per-IP budget for /auth/*. The SAML POST arrives
 * cross-site from the identity provider, so it opts out of the Origin check: what protects
 * it instead is the signed assertion answering a request this server issued, used once, and
 * the binding cookie checked on the same-site GET that finishes the flow.
 */
export function ssoRoutes(flows: SsoController, admin: SsoAdminController): FastifyPluginAsync {
  return async (app) => {
    app.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string', bodyLimit: SAML_BODY_LIMIT },
      (_request, body, done) => {
        done(null, Object.fromEntries(new URLSearchParams(String(body))));
      },
    );

    app.get('/auth/sso/providers', ANONYMOUS, async () => flows.signInOptions());
    app.get('/auth/sso/providers/:id/start', ANONYMOUS, async (r, reply) => flows.start(r, reply));
    app.get('/auth/sso/providers/:id/callback', ANONYMOUS, async (r, reply) =>
      flows.oidcCallback(r, reply),
    );
    app.post(
      '/auth/sso/providers/:id/callback',
      { config: { anonymous: true, crossSiteForm: true }, bodyLimit: SAML_BODY_LIMIT },
      async (r, reply) => flows.samlCallback(r, reply),
    );
    app.get('/auth/sso/complete', ANONYMOUS, async (r, reply) => flows.complete(r, reply));
    app.get('/auth/sso/providers/:id/metadata', ANONYMOUS, async (r, reply) =>
      flows.metadata(r, reply),
    );

    // Settings › Sign-in: workspace.sso.configure, checked in the services.
    app.get('/admin/sso/providers', async (r) => admin.listProviders(r));
    app.post('/admin/sso/providers', async (r, reply) => admin.createProvider(r, reply));
    app.get('/admin/sso/providers/:id', async (r) => admin.getProvider(r));
    app.patch('/admin/sso/providers/:id', async (r) => admin.updateProvider(r));
    app.delete('/admin/sso/providers/:id', async (r, reply) => admin.deleteProvider(r, reply));
    app.post('/admin/sso/providers/:id/tests', async (r, reply) => admin.startTest(r, reply));
    app.get('/admin/sso/policy', async (r) => admin.getPolicy(r));
    app.put('/admin/sso/policy', async (r) => admin.updatePolicy(r));
    app.put('/admin/sso/break-glass-admins/:id', async (r) => admin.addBreakGlass(r));
    app.delete('/admin/sso/break-glass-admins/:id', async (r, reply) =>
      admin.removeBreakGlass(r, reply),
    );
    app.get('/admin/scim-tokens', async (r) => admin.listScimTokens(r));
    app.post('/admin/scim-tokens', async (r, reply) => admin.createScimToken(r, reply));
    app.delete('/admin/scim-tokens/:id', async (r, reply) => admin.revokeScimToken(r, reply));
  };
}
