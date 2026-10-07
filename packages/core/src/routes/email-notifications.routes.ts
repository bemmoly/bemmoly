import type { FastifyPluginAsync } from 'fastify';
import {
  createEmailController,
  type EmailControllerDependencies,
} from '../controllers/email.controller.ts';
import { createNotificationsController } from '../controllers/notifications.controller.ts';
import { emailAdminRoutes, emailDevRoutes, emailUnsubscribeRoutes } from './email.routes.ts';
import { notificationsRoutes } from './notifications.routes.ts';

export type EmailNotificationRouteDependencies = EmailControllerDependencies;

/** Inbox, preferences, admin email, the dev mailbox and unsubscribe links, under /api/v1. */
export function emailNotificationRoutes(
  deps: EmailNotificationRouteDependencies,
): FastifyPluginAsync {
  const notifications = createNotificationsController(deps);
  const email = createEmailController(deps);
  return async (app) => {
    await app.register(notificationsRoutes(notifications));
    await app.register(emailAdminRoutes(email));
    await app.register(emailDevRoutes(email));
    await app.register(emailUnsubscribeRoutes(email));
  };
}
