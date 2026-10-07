import {
  devNotificationBodySchema,
  emailTestBodySchema,
  outboxOverviewQuerySchema,
  parseOrThrow,
  unsubscribeBodySchema,
  unsubscribeTokenQuerySchema,
  type EmailTestResponse,
  type MailboxResponse,
  type OutboxOverviewResponse,
  type UnsubscribeResponse,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticateRequest } from '../contracts/authn.ts';
import type { EmailService } from '../services/email/index.ts';
import type { NotificationsService } from '../services/notifications/index.ts';

export interface EmailControllerDependencies {
  authenticate: AuthenticateRequest;
  email: EmailService;
  notifications: NotificationsService;
}

/** The one-click post carries the token in the query; the web page sends it as JSON. */
function unsubscribeToken(request: FastifyRequest): string {
  const fromQuery = (request.query as Record<string, unknown> | undefined)?.['token'];
  const fromBody = (request.body as Record<string, unknown> | undefined)?.['token'];
  return parseOrThrow(unsubscribeBodySchema, { token: fromBody ?? fromQuery }).token;
}

export function createEmailController(deps: EmailControllerDependencies) {
  return {
    async outbox(request: FastifyRequest): Promise<OutboxOverviewResponse> {
      const actor = await deps.authenticate(request);
      return deps.email.outboxOverview(
        actor,
        parseOrThrow(outboxOverviewQuerySchema, request.query),
      );
    },
    async test(request: FastifyRequest): Promise<EmailTestResponse> {
      const actor = await deps.authenticate(request);
      return deps.email.sendTest(actor, parseOrThrow(emailTestBodySchema, request.body ?? {}));
    },
    async mailbox(request: FastifyRequest): Promise<MailboxResponse> {
      return deps.email.readMailbox(await deps.authenticate(request));
    },
    async clearMailbox(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await deps.email.clearMailbox(await deps.authenticate(request));
      reply.code(204);
    },
    async devNotify(request: FastifyRequest, reply: FastifyReply) {
      const actor = await deps.authenticate(request);
      const result = await deps.notifications.devNotify(
        actor,
        parseOrThrow(devNotificationBodySchema, request.body ?? {}),
      );
      reply.code(201);
      return result;
    },
    async previewUnsubscribe(request: FastifyRequest): Promise<UnsubscribeResponse> {
      const { token } = parseOrThrow(unsubscribeTokenQuerySchema, request.query);
      return deps.notifications.previewUnsubscribe(token);
    },
    async unsubscribe(request: FastifyRequest, reply: FastifyReply): Promise<UnsubscribeResponse> {
      const result = await deps.notifications.unsubscribe(unsubscribeToken(request));
      reply.code(201);
      return result;
    },
  };
}

export type EmailController = ReturnType<typeof createEmailController>;
