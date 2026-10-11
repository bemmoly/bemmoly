import {
  createWebhookBodySchema,
  createWebhookDeliveryBodySchema,
  updateWebhookBodySchema,
  webhookCatalogSchema,
  webhookDeliveriesPageSchema,
  webhookDeliverySchema,
  webhookListSchema,
  webhookSchema,
  webhookTargetListSchema,
  webhookWithSecretSchema,
  type CreateWebhookBody,
  type CreateWebhookDeliveryBody,
  type ListWebhookDeliveriesQuery,
  type UpdateWebhookBody,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

const WEBHOOKS = '/api/v1/admin/webhooks';

/**
 * Settings › Webhooks: endpoints, the event and format catalog, a webhook's delivery log,
 * a test send and a redelivery. Create and rotate answer with the secret, once.
 */
export function webhookEndpoints(http: Http) {
  return {
    catalog: async () => http.request('/api/v1/admin/webhook-catalog', webhookCatalogSchema),
    /** Names only, for a rule builder's "send webhook" picker; anyone signed in may read it. */
    targets: async () => http.request('/api/v1/webhook-targets', webhookTargetListSchema),
    list: async () => http.request(WEBHOOKS, webhookListSchema),
    get: async (id: string) => http.request(`${WEBHOOKS}/${enc(id)}`, webhookSchema),
    create: async (body: CreateWebhookBody) =>
      http.request(WEBHOOKS, webhookWithSecretSchema, {
        method: 'POST',
        body: validated(createWebhookBodySchema, body),
      }),
    update: async (id: string, body: UpdateWebhookBody) =>
      http.request(`${WEBHOOKS}/${enc(id)}`, webhookSchema, {
        method: 'PATCH',
        body: validated(updateWebhookBodySchema, body),
      }),
    remove: async (id: string) => http.send(`${WEBHOOKS}/${enc(id)}`, { method: 'DELETE' }),
    /** A new signing secret replaces the old one at once; the answer carries it, once. */
    rotateSecret: async (id: string) =>
      http.request(`${WEBHOOKS}/${enc(id)}/secrets`, webhookWithSecretSchema, {
        method: 'POST',
        body: {},
      }),
    deliveries: async (id: string, query: ListWebhookDeliveriesQuery = {}) =>
      http.request(`${WEBHOOKS}/${enc(id)}/deliveries`, webhookDeliveriesPageSchema, {
        query: { cursor: query.cursor, limit: query.limit, status: query.status },
      }),
    /** A ping answers once its one attempt is done; a redelivery answers queued. */
    deliver: async (id: string, body: CreateWebhookDeliveryBody) =>
      http.request(`${WEBHOOKS}/${enc(id)}/deliveries`, webhookDeliverySchema, {
        method: 'POST',
        body: validated(createWebhookDeliveryBodySchema, body),
      }),
  };
}
