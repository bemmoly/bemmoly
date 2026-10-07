import {
  devMailboxSchema,
  emailTestRequestSchema,
  emailTestResultSchema,
  notificationPreferencesSchema,
  notificationSchema,
  notificationsPageSchema,
  notificationsQuerySchema,
  outboxPageSchema,
  outboxQuerySchema,
  searchQuerySchema,
  searchResponseSchema,
  updateNotificationPreferencesRequestSchema,
  type NotificationsQuery,
  type OutboxStatus,
  type SearchQuery,
  type UpdateNotificationPreferencesRequest,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

export function messagingEndpoints(http: Http) {
  return {
    notifications: {
      list: async (query: NotificationsQuery = {}) =>
        http.request('/api/v1/notifications', notificationsPageSchema, {
          query: validated(notificationsQuerySchema, query),
        }),
      markRead: async (id: string) =>
        http.request(`/api/v1/notifications/${enc(id)}`, notificationSchema, {
          method: 'PATCH',
          body: { read: true },
        }),
      readAll: async () => http.send('/api/v1/notifications/read-all', { method: 'POST' }),
      preferences: async () =>
        http.request('/api/v1/notification-preferences', notificationPreferencesSchema),
      savePreferences: async (body: UpdateNotificationPreferencesRequest) =>
        http.request('/api/v1/notification-preferences', notificationPreferencesSchema, {
          method: 'PUT',
          body: validated(updateNotificationPreferencesRequestSchema, body),
        }),
    },
    email: {
      test: async (to: string) =>
        http.request('/api/v1/admin/email/test', emailTestResultSchema, {
          method: 'POST',
          body: validated(emailTestRequestSchema, { to }),
        }),
      outbox: async (status?: OutboxStatus, cursor?: string) =>
        http.request('/api/v1/admin/email/outbox', outboxPageSchema, {
          query: validated(outboxQuerySchema, { status, cursor }),
        }),
      /** Development only; answers 404 when the log sender is not in use. */
      devMailbox: async () => http.request('/api/v1/dev/mailbox', devMailboxSchema),
    },
    search: async (query: SearchQuery) =>
      http.request('/api/v1/search', searchResponseSchema, {
        query: validated(searchQuerySchema, query),
      }),
  };
}
