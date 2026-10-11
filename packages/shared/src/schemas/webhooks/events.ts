import { z } from 'zod';

/*
 * The domain events modules publish for the world outside: outgoing webhooks
 * subscribe to them by kind and Work's automation rules trigger on the issue
 * ones. The kinds are the contract; a module owns the payload of its own.
 */

export const DOMAIN_EVENT_KINDS = {
  issueCreated: 'issue.created',
  issueUpdated: 'issue.updated',
  issueTransitioned: 'issue.transitioned',
  issueCommented: 'issue.commented',
  sprintStarted: 'sprint.started',
  sprintCompleted: 'sprint.completed',
  pagePublished: 'page.published',
  pageUpdated: 'page.updated',
} as const;

export type DomainEventKind = (typeof DOMAIN_EVENT_KINDS)[keyof typeof DOMAIN_EVENT_KINDS];

/** What Settings › Webhooks offers, grouped by the module that publishes each kind. */
export const WEBHOOK_EVENTS = [
  { kind: DOMAIN_EVENT_KINDS.issueCreated, moduleId: 'work', label: 'Issue created' },
  { kind: DOMAIN_EVENT_KINDS.issueUpdated, moduleId: 'work', label: 'Issue updated' },
  { kind: DOMAIN_EVENT_KINDS.issueTransitioned, moduleId: 'work', label: 'Issue transitioned' },
  { kind: DOMAIN_EVENT_KINDS.issueCommented, moduleId: 'work', label: 'Comment added' },
  { kind: DOMAIN_EVENT_KINDS.sprintStarted, moduleId: 'work', label: 'Sprint started' },
  { kind: DOMAIN_EVENT_KINDS.sprintCompleted, moduleId: 'work', label: 'Sprint completed' },
  { kind: DOMAIN_EVENT_KINDS.pagePublished, moduleId: 'docs', label: 'Page published' },
  { kind: DOMAIN_EVENT_KINDS.pageUpdated, moduleId: 'docs', label: 'Page updated' },
] as const;

export const WEBHOOK_EVENT_KINDS = WEBHOOK_EVENTS.map((event) => event.kind) as [
  DomainEventKind,
  ...DomainEventKind[],
];

export const webhookEventKindSchema = z.enum(WEBHOOK_EVENT_KINDS);

/**
 * Fields every published domain event payload carries beside its own, so a
 * webhook or a chat message can say what happened without loading anything.
 * Payloads travel over NOTIFY, so they hold ids and short text, never documents.
 */
export const domainEventSummarySchema = z.object({
  /** One line: "PLT-12 Fix the login moved to Done". */
  summary: z.string().max(500),
  /** App-relative link to the thing the event is about: "/work/issue/PLT-12". */
  url: z.string().max(500).optional(),
});

export type DomainEventSummary = z.infer<typeof domainEventSummarySchema>;

/**
 * `webhook.requested`: an automation rule's "send webhook" action. The kernel
 * queues one delivery to the named webhook, whatever its event filter says.
 */
export const WEBHOOK_REQUESTED_EVENT = 'webhook.requested';

/** The event name such a delivery carries in its envelope and headers. */
export const AUTOMATION_WEBHOOK_EVENT = 'automation.triggered';

export const webhookRequestedPayloadSchema = domainEventSummarySchema.extend({
  webhookId: z.uuid(),
  /** Module-specific fields, sent as the envelope's `data`. */
  data: z.record(z.string(), z.unknown()).default({}),
});

export type WebhookRequestedPayload = z.input<typeof webhookRequestedPayloadSchema>;
