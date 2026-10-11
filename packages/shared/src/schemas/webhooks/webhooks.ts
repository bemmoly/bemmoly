import { z } from 'zod';
import { timestampSchema } from '../contracts/common.ts';
import { keysetPageSchema, keysetQuerySchema } from '../identity/common.ts';
import { webhookEventKindSchema } from './events.ts';
import { webhookFormatPresetSchema, webhookFormatSchema } from './formats.ts';

/*
 * Settings › Webhooks: endpoints an admin defines, the deliveries each one
 * got, and the versioned envelope a receiver parses. The signing secret is
 * shown once, when it is made (create or rotate); afterwards only its last
 * four characters are.
 */

/** Bumped only when the envelope changes in a way a receiver must handle. */
export const WEBHOOK_PAYLOAD_VERSION = '1';

/** Header names a receiver reads; the signature is `t=<unix seconds>,v1=<hex>`. */
export const WEBHOOK_HEADERS = {
  signature: 'bemmoly-signature',
  event: 'bemmoly-event',
  delivery: 'bemmoly-delivery',
  version: 'bemmoly-webhook-version',
} as const;

/** A receiver should refuse a signature older than this, to stop replays. */
export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

/** One try plus five retries with exponential backoff (tech design §9). */
export const WEBHOOK_MAX_ATTEMPTS = 6;

/** Failed deliveries in a row, retries spent, after which a webhook turns itself off. */
export const WEBHOOK_AUTO_DISABLE_AFTER = 5;

export const webhookUrlSchema = z
  .url({ protocol: /^https?$/, message: 'Use an http or https address' })
  .max(2000);

export const WEBHOOK_STATUSES = ['active', 'paused', 'failing'] as const;

export const webhookSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  url: z.string(),
  events: z.array(webhookEventKindSchema),
  format: webhookFormatSchema,
  enabled: z.boolean(),
  /** `failing` when the webhook turned itself off after failed deliveries. */
  status: z.enum(WEBHOOK_STATUSES),
  disabledReason: z.string().nullable(),
  consecutiveFailures: z.number().int().nonnegative(),
  /** The secret's last four characters, so an admin can tell two apart. */
  secretHint: z.string(),
  lastDeliveryAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

/** Create and rotate answer with the secret, the only time it is ever sent. */
export const webhookWithSecretSchema = webhookSchema.extend({ secret: z.string() });

export const webhookListSchema = z.object({ items: z.array(webhookSchema) });

/** What a rule builder may pick from: names only, readable by anyone signed in. */
export const webhookTargetSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  enabled: z.boolean(),
});
export const webhookTargetListSchema = z.object({ items: z.array(webhookTargetSchema) });

export const createWebhookBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: webhookUrlSchema,
  events: z.array(webhookEventKindSchema).min(1, 'Pick at least one event').max(50),
  format: webhookFormatSchema.default('json'),
  enabled: z.boolean().default(true),
});

/** Turning a webhook back on clears its failure count. */
export const updateWebhookBodySchema = createWebhookBodySchema.partial();

export const webhookIdParamsSchema = z.object({ id: z.uuid() });

export const WEBHOOK_DELIVERY_STATUSES = ['pending', 'retrying', 'succeeded', 'failed'] as const;
export const webhookDeliveryStatusSchema = z.enum(WEBHOOK_DELIVERY_STATUSES);

export const webhookDeliverySchema = z.object({
  id: z.uuid(),
  webhookId: z.uuid(),
  /** A domain event kind, `ping` for a test send, or `automation.triggered`. */
  event: z.string(),
  /** Shared by every delivery of one event, and by a redelivery of it. */
  eventId: z.uuid(),
  status: webhookDeliveryStatusSchema,
  attempt: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  responseStatus: z.number().int().nullable(),
  /** The first 500 characters of the receiver's answer. */
  responseExcerpt: z.string().nullable(),
  error: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  nextAttemptAt: timestampSchema.nullable(),
  redeliveryOf: z.uuid().nullable(),
  createdAt: timestampSchema,
  deliveredAt: timestampSchema.nullable(),
});

export const listWebhookDeliveriesQuerySchema = keysetQuerySchema.extend({
  status: webhookDeliveryStatusSchema.optional(),
});

export const webhookDeliveriesPageSchema = keysetPageSchema(webhookDeliverySchema);

/** A test send (`ping`, one attempt, answered when done) or a redelivery of an earlier one. */
export const createWebhookDeliveryBodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ping') }),
  z.object({ kind: z.literal('redelivery'), deliveryId: z.uuid() }),
]);

export const webhookCatalogSchema = z.object({
  events: z.array(
    z.object({ kind: webhookEventKindSchema, moduleId: z.string(), label: z.string() }),
  ),
  formats: z.array(webhookFormatPresetSchema),
});

/** The body of a `json` delivery. */
export const webhookEnvelopeSchema = z.object({
  version: z.literal(WEBHOOK_PAYLOAD_VERSION),
  id: z.uuid(),
  event: z.string(),
  occurredAt: timestampSchema,
  workspace: z.object({ url: z.string() }),
  actor: z.object({ kind: z.string(), id: z.string(), userId: z.string().optional() }).nullable(),
  entity: z.object({ kind: z.string(), id: z.string() }).nullable(),
  summary: z.string(),
  url: z.string().nullable(),
  data: z.unknown(),
});

export type Webhook = z.infer<typeof webhookSchema>;
export type WebhookWithSecret = z.infer<typeof webhookWithSecretSchema>;
export type WebhookTarget = z.infer<typeof webhookTargetSchema>;
export type CreateWebhookBody = z.input<typeof createWebhookBodySchema>;
export type UpdateWebhookBody = z.input<typeof updateWebhookBodySchema>;
export type WebhookDelivery = z.infer<typeof webhookDeliverySchema>;
export type WebhookDeliveryStatus = z.infer<typeof webhookDeliveryStatusSchema>;
export type ListWebhookDeliveriesQuery = Partial<z.infer<typeof listWebhookDeliveriesQuerySchema>>;
export type WebhookDeliveriesPage = z.infer<typeof webhookDeliveriesPageSchema>;
export type CreateWebhookDeliveryBody = z.infer<typeof createWebhookDeliveryBodySchema>;
export type WebhookCatalog = z.infer<typeof webhookCatalogSchema>;
export type WebhookEnvelope = z.infer<typeof webhookEnvelopeSchema>;
