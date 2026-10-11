import {
  domainEventSummarySchema,
  WEBHOOK_EVENTS,
  WEBHOOK_FORMATS,
  WEBHOOK_PAYLOAD_VERSION,
  type WebhookEnvelope,
  type WebhookFormat,
} from '@bemmoly/shared/webhooks';
import type { DomainEvent } from '../../contracts/event-bus.ts';

/** The test send's event name, and its fixed message. */
export const PING_EVENT = 'ping';

const LABELS = new Map<string, string>([
  ...WEBHOOK_EVENTS.map((event) => [event.kind, event.label] as const),
  [PING_EVENT, 'Test delivery'],
  ['automation.triggered', 'Automation rule'],
]);

export const labelOf = (event: string): string => LABELS.get(event) ?? event;

function absolute(publicUrl: string, path: string | undefined): string | null {
  if (!path) return null;
  try {
    return new URL(path, publicUrl).toString();
  } catch {
    return null;
  }
}

/** Splits the summary fields every payload carries from the module's own data. */
function summaryOf(payload: unknown, event: string) {
  const parsed = domainEventSummarySchema.safeParse(payload);
  if (!parsed.success) return { summary: labelOf(event), url: undefined, data: payload ?? {} };
  const data: Record<string, unknown> = { ...(payload as Record<string, unknown>) };
  delete data['summary'];
  delete data['url'];
  return { summary: parsed.data.summary, url: parsed.data.url, data };
}

/** The versioned body of a `json` delivery, built once per event and stored with it. */
export function envelopeFor(
  event: Pick<DomainEvent, 'kind' | 'occurredAt' | 'actor' | 'entity' | 'payload'>,
  eventId: string,
  publicUrl: string,
): WebhookEnvelope {
  const { summary, url, data } = summaryOf(event.payload, event.kind);
  return {
    version: WEBHOOK_PAYLOAD_VERSION,
    id: eventId,
    event: event.kind,
    occurredAt: event.occurredAt.toISOString(),
    workspace: { url: publicUrl },
    actor: event.actor
      ? {
          kind: event.actor.kind,
          id: event.actor.id,
          ...(event.actor.userId ? { userId: event.actor.userId } : {}),
        }
      : null,
    entity: event.entity ? { kind: event.entity.kind, id: event.entity.id } : null,
    summary,
    url: absolute(publicUrl, url),
    data,
  };
}

export function pingEnvelope(eventId: string, publicUrl: string, now: Date): WebhookEnvelope {
  return envelopeFor(
    {
      kind: PING_EVENT,
      occurredAt: now,
      payload: { summary: 'Test delivery from Bemmoly: this webhook is reachable', url: '/' },
    },
    eventId,
    publicUrl,
  );
}

function fill(value: unknown, values: Readonly<Record<string, string>>): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (match, name: string) => values[name] ?? match);
  }
  if (Array.isArray(value)) return value.map((item) => fill(item, values));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, fill(item, values)]),
    );
  }
  return value;
}

/** The request body: the envelope itself, or a chat preset filled from it. */
export function renderBody(format: WebhookFormat, envelope: WebhookEnvelope): string {
  const preset = WEBHOOK_FORMATS.find((entry) => entry.id === format);
  if (!preset?.template) return JSON.stringify(envelope);
  return JSON.stringify(
    fill(preset.template, {
      summary: envelope.summary,
      url: envelope.url ?? envelope.workspace.url,
      event: envelope.event,
      label: labelOf(envelope.event),
    }),
  );
}
