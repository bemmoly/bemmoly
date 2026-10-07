import { z } from 'zod';
import { idSchema, pageQuerySchema, pageSchema, timestampSchema } from './common.ts';

export const emailTestRequestSchema = z.object({ to: z.email('Enter a valid email address') });

const dnsCheckSchema = z.enum(['pass', 'missing', 'fail', 'unknown']);

/** `message` is the SMTP conversation's reason in plain words, success or failure. */
export const emailTestResultSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  dns: z
    .object({ spf: dnsCheckSchema, dmarc: dnsCheckSchema, records: z.array(z.string()) })
    .nullable(),
});

export const outboxStatusSchema = z.enum(['queued', 'sent', 'failed']);

export const outboxEmailSchema = z.object({
  id: idSchema,
  to: z.string(),
  subject: z.string(),
  status: outboxStatusSchema,
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  createdAt: timestampSchema,
  sentAt: timestampSchema.nullable(),
});

export const outboxQuerySchema = pageQuerySchema.extend({ status: outboxStatusSchema.optional() });

export const outboxPageSchema = pageSchema(outboxEmailSchema).extend({
  failedCount: z.number().int().nonnegative(),
  failedSince: timestampSchema.nullable(),
});

/** Development only: what the `log` email sender captured. */
export const devMailboxSchema = z.object({
  enabled: z.boolean(),
  items: z.array(
    z.object({
      id: idSchema,
      to: z.string(),
      subject: z.string(),
      text: z.string(),
      html: z.string().nullable(),
      createdAt: timestampSchema,
    }),
  ),
});

export const searchResultSchema = z.object({
  kind: z.string().min(1),
  id: idSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  href: z.string(),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1),
  kinds: z.array(z.string().min(1)).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const searchResponseSchema = z.object({ items: z.array(searchResultSchema) });

export type EmailTestRequest = z.infer<typeof emailTestRequestSchema>;
export type EmailTestResult = z.infer<typeof emailTestResultSchema>;
export type OutboxStatus = z.infer<typeof outboxStatusSchema>;
export type OutboxEmail = z.infer<typeof outboxEmailSchema>;
export type OutboxPage = z.infer<typeof outboxPageSchema>;
export type DevMailbox = z.infer<typeof devMailboxSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
