import { z } from 'zod';

/** Shapes confirmed by the email and notifications stream. */
export const emailTestRequestSchema = z.object({
  to: z.email('Enter a valid email address').optional(),
});

/** A DNS verdict; the server may send a word or an object with the record to add. */
const dnsVerdictSchema = z.union([
  z.string(),
  z.looseObject({
    status: z.string().optional(),
    record: z.string().nullable().optional(),
    expected: z.string().nullable().optional(),
  }),
]);

/** 200 even when sending failed: `failure` says which stage and why, in plain words. */
export const emailTestResultSchema = z.object({
  sent: z.boolean(),
  provider: z.string(),
  to: z.string(),
  messageId: z.string().nullable(),
  failure: z
    .object({ stage: z.string(), message: z.string(), serverResponse: z.string().nullable() })
    .nullable(),
  deliverability: z
    .object({ domain: z.string(), spf: dnsVerdictSchema, dmarc: dnsVerdictSchema })
    .nullable(),
});

export const outboxSummarySchema = z.object({
  counts: z.record(z.string(), z.number()),
  failures: z
    .object({
      count: z.number().int(),
      since: z.string().nullable(),
      topReason: z.string().nullable(),
    })
    .nullable(),
  recentFailures: z.array(
    z.looseObject({
      id: z.string().optional(),
      to: z.string().optional(),
      subject: z.string().optional(),
      lastError: z.string().nullable().optional(),
      attempts: z.number().optional(),
      failedAt: z.string().nullable().optional(),
      createdAt: z.string().optional(),
    }),
  ),
});

/** 404 unless the `log` provider is in use; needs workspace.email.manage. */
export const devMailboxSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      to: z.string(),
      from: z.string(),
      subject: z.string(),
      html: z.string().nullable(),
      text: z.string().nullable(),
      headers: z.record(z.string(), z.unknown()).nullable().optional(),
      capturedAt: z.string(),
    }),
  ),
});

/** Anonymous, from the link in every notification email. */
export const unsubscriptionPreviewSchema = z.object({
  scope: z.string(),
  label: z.string(),
  emailEnabled: z.boolean(),
});

export const searchResultSchema = z.object({
  kind: z.string().min(1),
  id: z.string().min(1),
  title: z.string(),
  subtitle: z.string().nullable(),
  href: z.string(),
  /** A short handle printed before the title, such as an issue key. */
  key: z.string().nullable().optional(),
  /** The palette group the result belongs to: the label of the provider that found it. */
  group: z.string().optional(),
  /** How ⌘K draws it, when the provider knows: an issue's type tile and its status. */
  look: z
    .object({
      type: z
        .object({
          key: z.string(),
          icon: z.string().nullable(),
          color: z.string().nullable(),
          level: z.string().nullable(),
        })
        .optional(),
      status: z
        .object({ category: z.enum(['todo', 'in_progress', 'done']), name: z.string() })
        .optional(),
    })
    .optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1),
  kinds: z.array(z.string().min(1)).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

/** The same query as it arrives in a URL: kinds comma-separated, the limit a string. */
export const searchRequestQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  kinds: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((kind) => kind.trim())
            .filter(Boolean)
        : undefined,
    ),
  limit: z.coerce.number().int().min(1).max(50).default(8),
});

export const searchResponseSchema = z.object({ items: z.array(searchResultSchema) });

export type EmailTestRequest = z.infer<typeof emailTestRequestSchema>;
export type EmailTestResult = z.infer<typeof emailTestResultSchema>;
export type OutboxSummary = z.infer<typeof outboxSummarySchema>;
export type DevMailbox = z.infer<typeof devMailboxSchema>;
export type UnsubscriptionPreview = z.infer<typeof unsubscriptionPreviewSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchRequestQuery = z.infer<typeof searchRequestQuerySchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
