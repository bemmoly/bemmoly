import { z } from 'zod';
import { notificationTargetInputSchema } from '../notifications/events.ts';
import { notificationKindSchema } from '../notifications/kinds.ts';

export const EMAIL_PROVIDERS = ['smtp', 'log'] as const;
export const emailProviderSchema = z.enum(EMAIL_PROVIDERS);
export type EmailProviderId = z.infer<typeof emailProviderSchema>;

/** `starttls` upgrades a plain connection (587); `tls` is implicit TLS (465). */
export const SMTP_SECURITY_MODES = ['starttls', 'tls', 'none'] as const;
export const smtpSecuritySchema = z.enum(SMTP_SECURITY_MODES);
export type SmtpSecurity = z.infer<typeof smtpSecuritySchema>;

export const OUTBOX_STATUSES = ['pending', 'sending', 'sent', 'failed'] as const;
export const outboxStatusSchema = z.enum(OUTBOX_STATUSES);
export type OutboxStatus = z.infer<typeof outboxStatusSchema>;

export const outboxFailureSchema = z.object({
  id: z.string(),
  kind: z.string(),
  to: z.string(),
  subject: z.string(),
  attempts: z.number().int(),
  lastError: z.string().nullable(),
  failedAt: z.iso.datetime(),
});

/** Settings › Email: "12 emails failed since Tuesday: authentication rejected". */
export const outboxOverviewResponseSchema = z.object({
  counts: z.record(outboxStatusSchema, z.number().int().nonnegative()),
  failures: z
    .object({
      count: z.number().int().positive(),
      since: z.iso.datetime(),
      topReason: z.string().nullable(),
    })
    .nullable(),
  recentFailures: z.array(outboxFailureSchema),
});

export const outboxOverviewQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export const emailTestBodySchema = z.object({
  /** Defaults to the signed-in admin's own address. */
  to: z.email().optional(),
});

export const SMTP_STAGES = ['config', 'dns', 'connect', 'tls', 'auth', 'send'] as const;
export const smtpStageSchema = z.enum(SMTP_STAGES);
export type SmtpStage = z.infer<typeof smtpStageSchema>;

export const dnsRecordCheckSchema = z.object({
  status: z.enum(['ok', 'missing', 'invalid', 'unknown']),
  /** The record found, as published. */
  found: z.string().nullable(),
  message: z.string(),
  /** What to add when missing or invalid: host, type and value. */
  suggested: z.object({ host: z.string(), type: z.literal('TXT'), value: z.string() }).nullable(),
});

export const deliverabilityCheckSchema = z.object({
  domain: z.string(),
  spf: dnsRecordCheckSchema,
  dmarc: dnsRecordCheckSchema,
});

export const emailTestResponseSchema = z.object({
  sent: z.boolean(),
  provider: emailProviderSchema,
  to: z.string(),
  messageId: z.string().nullable(),
  failure: z
    .object({
      stage: smtpStageSchema,
      /** Plain words: "The mail server rejected the username or password." */
      message: z.string(),
      /** The server's own reply, when there was one. */
      serverResponse: z.string().nullable(),
    })
    .nullable(),
  deliverability: deliverabilityCheckSchema.nullable(),
});

export const mailboxEntrySchema = z.object({
  id: z.string(),
  to: z.array(z.string()),
  from: z.string().nullable(),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
  headers: z.record(z.string(), z.string()),
  capturedAt: z.iso.datetime(),
});

export const mailboxResponseSchema = z.object({ items: z.array(mailboxEntrySchema) });

/** The same URL as the List-Unsubscribe header: GET previews, POST unsubscribes. */
export const unsubscribeTokenQuerySchema = z.object({ token: z.string().min(10).max(512) });

/** JSON from the web page, or the RFC 8058 one-click form post with the token in the query. */
export const unsubscribeBodySchema = z.object({ token: z.string().min(10).max(512) });

export const unsubscribeResponseSchema = z.object({
  /** A notification kind, or `digest` for the batched summary. */
  scope: z.string(),
  label: z.string(),
  emailEnabled: z.boolean(),
});

export const devNotificationBodySchema = z.object({
  kind: notificationKindSchema.default('comment'),
  /** Defaults to the signed-in user. */
  recipientIds: z.array(z.uuid()).min(1).max(50).optional(),
  actorName: z.string().max(200).default('Bemmoly'),
  target: notificationTargetInputSchema.default({ kind: 'dev', id: 'dev-1', label: 'DEV-1' }),
  body: z.string().max(2000).default('A test notification from the dev endpoint.'),
});

export const devNotificationResponseSchema = z.object({ accepted: z.boolean() });

export type OutboxFailure = z.infer<typeof outboxFailureSchema>;
export type OutboxOverviewResponse = z.infer<typeof outboxOverviewResponseSchema>;
export type EmailTestBody = z.infer<typeof emailTestBodySchema>;
export type DnsRecordCheck = z.infer<typeof dnsRecordCheckSchema>;
export type DeliverabilityCheck = z.infer<typeof deliverabilityCheckSchema>;
export type EmailTestResponse = z.infer<typeof emailTestResponseSchema>;
export type MailboxEntry = z.infer<typeof mailboxEntrySchema>;
export type MailboxResponse = z.infer<typeof mailboxResponseSchema>;
export type UnsubscribeResponse = z.infer<typeof unsubscribeResponseSchema>;
export type DevNotificationBody = z.infer<typeof devNotificationBodySchema>;
