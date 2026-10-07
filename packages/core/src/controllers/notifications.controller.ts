import {
  notificationIdParamsSchema,
  notificationListQuerySchema,
  notificationPatchBodySchema,
  notificationPreferencesPutBodySchema,
  parseOrThrow,
  type NotificationListResponse,
  type NotificationPatchResponse,
  type NotificationPreferencesResponse,
  type NotificationReadAllResponse,
} from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import type { AuthenticateRequest } from '../contracts/authn.ts';
import type { NotificationsService } from '../services/notifications/index.ts';

export interface NotificationsControllerDependencies {
  authenticate: AuthenticateRequest;
  notifications: NotificationsService;
}

export function createNotificationsController(deps: NotificationsControllerDependencies) {
  return {
    async list(request: FastifyRequest): Promise<NotificationListResponse> {
      const actor = await deps.authenticate(request);
      return deps.notifications.list(
        actor,
        parseOrThrow(notificationListQuerySchema, request.query),
      );
    },
    async mark(request: FastifyRequest): Promise<NotificationPatchResponse> {
      const actor = await deps.authenticate(request);
      const { id } = parseOrThrow(notificationIdParamsSchema, request.params);
      return deps.notifications.mark(
        actor,
        id,
        parseOrThrow(notificationPatchBodySchema, request.body),
      );
    },
    async readAll(request: FastifyRequest): Promise<NotificationReadAllResponse> {
      return deps.notifications.readAll(await deps.authenticate(request));
    },
    async preferences(request: FastifyRequest): Promise<NotificationPreferencesResponse> {
      return deps.notifications.preferences(await deps.authenticate(request));
    },
    async updatePreferences(request: FastifyRequest): Promise<NotificationPreferencesResponse> {
      const actor = await deps.authenticate(request);
      return deps.notifications.updatePreferences(
        actor,
        parseOrThrow(notificationPreferencesPutBodySchema, request.body),
      );
    },
  };
}

export type NotificationsController = ReturnType<typeof createNotificationsController>;
