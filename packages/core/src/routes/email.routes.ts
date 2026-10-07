import type { FastifyPluginAsync } from 'fastify';
import type { EmailController } from '../controllers/email.controller.ts';

export function emailAdminRoutes(controller: EmailController): FastifyPluginAsync {
  return async (app) => {
    app.get('/admin/email/outbox', async (request) => controller.outbox(request));
    app.post('/admin/email/test', async (request) => controller.test(request));
  };
}

/** Answer 404 unless the email provider is `log`; that setting is the gate, not the environment. */
export function emailDevRoutes(controller: EmailController): FastifyPluginAsync {
  return async (app) => {
    app.get('/dev/mailbox', async (request) => controller.mailbox(request));
    app.delete('/dev/mailbox', async (request, reply) => controller.clearMailbox(request, reply));
    app.post('/dev/notifications', async (request, reply) => controller.devNotify(request, reply));
  };
}

/**
 * Anonymous by design: the links in emails and the RFC 8058 one-click post from
 * mail clients carry a signed token instead of a session. The token can only
 * turn email off for one kind.
 */
export function emailUnsubscribeRoutes(controller: EmailController): FastifyPluginAsync {
  return async (app) => {
    app.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string', bodyLimit: 4096 },
      (_request, body, done) => {
        done(null, Object.fromEntries(new URLSearchParams(String(body))));
      },
    );
    // Some mail clients send the one-click post as multipart; the token is in the query either way.
    app.addContentTypeParser(
      'multipart/form-data',
      { parseAs: 'string', bodyLimit: 4096 },
      (_request, _body, done) => done(null, {}),
    );
    app.get('/email-unsubscriptions', async (request) => controller.previewUnsubscribe(request));
    app.post('/email-unsubscriptions', async (request, reply) =>
      controller.unsubscribe(request, reply),
    );
  };
}
