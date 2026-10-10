import {
  devMailboxSchema,
  emailTestRequestSchema,
  emailTestResultSchema,
  markNotificationResponseSchema,
  notificationPreferencesSchema,
  notificationsPageSchema,
  notificationsQuerySchema,
  outboxSummarySchema,
  readAllResponseSchema,
  searchQuerySchema,
  searchResponseSchema,
  unsubscriptionPreviewSchema,
  updateNotificationPreferencesRequestSchema,
  updateNotificationRequestSchema,
  type NotificationsQuery,
  type SearchQuery,
  type UpdateNotificationPreferencesRequest,
  type UpdateNotificationRequest,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

export function messagingEndpoints(http: Http) {
  /** Read, done (archive) or snooze one entry and its group; the inverse value is the undo. */
  const update = async (id: string, patch: UpdateNotificationRequest) =>
    http.request(`/api/v1/notifications/${enc(id)}`, markNotificationResponseSchema, {
      method: 'PATCH',
      body: validated(updateNotificationRequestSchema, patch),
    });
  return {
    notifications: {
      /** `view` is `inbox` unless given; `unreadCount` always counts the inbox. */
      list: async (query: NotificationsQuery = {}) =>
        http.request('/api/v1/notifications', notificationsPageSchema, {
          query: validated(notificationsQuerySchema, query),
        }),
      update,
      setRead: async (id: string, read = true) => update(id, { read }),
      readAll: async () =>
        http.request('/api/v1/notifications/read-all', readAllResponseSchema, { method: 'POST' }),
      preferences: async () =>
        http.request('/api/v1/notification-preferences', notificationPreferencesSchema),
      savePreferences: async (body: UpdateNotificationPreferencesRequest) =>
        http.request('/api/v1/notification-preferences', notificationPreferencesSchema, {
          method: 'PUT',
          body: validated(updateNotificationPreferencesRequestSchema, body),
        }),
    },
    email: {
      /** 200 even when sending fails; `failure` explains it. Omit `to` to send to yourself. */
      test: async (to?: string) =>
        http.request('/api/v1/admin/email/test', emailTestResultSchema, {
          method: 'POST',
          body: validated(emailTestRequestSchema, to ? { to } : {}),
        }),
      outbox: async (limit = 20) =>
        http.request('/api/v1/admin/email/outbox', outboxSummarySchema, { query: { limit } }),
      /** 404 unless the server uses the `log` email provider. */
      devMailbox: async () => http.request('/api/v1/dev/mailbox', devMailboxSchema),
      clearDevMailbox: async () => http.send('/api/v1/dev/mailbox', { method: 'DELETE' }),
    },
    unsubscriptions: {
      preview: async (token: string) =>
        http.request('/api/v1/email-unsubscriptions', unsubscriptionPreviewSchema, {
          query: { token },
        }),
      confirm: async (token: string) =>
        http.send('/api/v1/email-unsubscriptions', { method: 'POST', body: { token } }),
    },
    search: async (query: SearchQuery) =>
      http.request('/api/v1/search', searchResponseSchema, {
        query: validated(searchQuerySchema, query),
      }),
  };
}
