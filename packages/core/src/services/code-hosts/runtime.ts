import type { Logger } from 'pino';
import type { SqlClient } from '../../clients/postgres.ts';
import type { AddressPolicy } from '../../clients/guarded-fetch.ts';
import type { CodeActivity, CodeEvent, CodeEventOf } from '../../contracts/code-hosts.ts';
import type {
  CodeActivityConsumer,
  CodeActivityResult,
  CodeAppPermissions,
  CodeEventConsumer,
} from '../../modules/code.ts';
import type { RequestContext } from '../authz/index.ts';
import type { SecretBox } from '../settings/index.ts';
import type { IntegrationRow } from './store.ts';
import type { ActivityDraft } from './types.ts';

/** What receiving, testing and backfilling share. */
export interface CodeHostRuntime {
  sql: SqlClient;
  /** Seals and opens the webhook secret and API credentials with BEMMOLY_SECRET_KEY. */
  secrets: SecretBox;
  /** The enabled modules' consumers, read on every delivery so enabling Work takes effect. */
  consumers: () => readonly CodeActivityConsumer[];
  /** The enabled modules' event consumers (a push, a pull request, a check). */
  eventConsumers?: () => readonly CodeEventConsumer[];
  /** The enabled modules' extra GitHub App permissions, merged into the manifest. */
  appPermissions?: () => readonly CodeAppPermissions[];
  /** A system context the consumers act under: `code-host:<id>`, allowed by authorize. */
  systemContext: (actorId: string) => RequestContext;
  /** BEMMOLY_ALLOW_PRIVATE_URLS: self-managed hosts may then sit on any address. */
  allowPrivateUrls: boolean;
  /** Tests hand a fake host API; production sends with the guarded fetch. */
  fetch?: typeof fetch;
  logger?: Pick<Logger, 'info' | 'warn' | 'error'>;
}

/**
 * The cloud products are public; a self-managed server or Enterprise Server usually sits on
 * the company network, so private addresses are fine, but never link-local metadata.
 */
export function addressPolicyFor(
  rt: Pick<CodeHostRuntime, 'allowPrivateUrls'>,
  row: Pick<IntegrationRow, 'base_url'>,
): AddressPolicy {
  if (rt.allowPrivateUrls) return 'any';
  return row.base_url ? 'local' : 'public';
}

/** Hands one delivery's activities to every enabled consumer; returns what they did. */
export async function dispatchActivities(
  rt: CodeHostRuntime,
  row: IntegrationRow,
  drafts: readonly ActivityDraft[],
): Promise<Required<CodeActivityResult>> {
  const activities: CodeActivity[] = drafts.map((draft) => ({
    ...draft,
    integrationId: row.id,
    hostKind: row.kind,
  }));
  const ctx = rt.systemContext(`code-host:${row.id}`);
  let linked = 0;
  const notes: string[] = [];
  for (const consumer of rt.consumers()) {
    const result = await consumer.apply(activities, ctx);
    linked += result.linked;
    notes.push(...(result.notes ?? []));
  }
  return { linked, notes };
}

/** Hands one delivery's events to every enabled event consumer; returns their notes. */
export async function dispatchEvents(
  rt: CodeHostRuntime,
  row: IntegrationRow,
  deliveryId: string,
  events: readonly CodeEvent[],
): Promise<string[]> {
  const consumers = rt.eventConsumers?.() ?? [];
  if (events.length === 0 || consumers.length === 0) return [];
  const stamped: CodeEventOf[] = events.map((event) => ({
    ...event,
    integrationId: row.id,
    hostKind: row.kind,
    deliveryId,
  }));
  const ctx = rt.systemContext(`code-host:${row.id}`);
  const notes: string[] = [];
  for (const consumer of consumers) {
    const result = await consumer.apply(stamped, ctx);
    notes.push(...(result.notes ?? []));
  }
  return notes;
}

/** "· 2 links updated": what the consumers did, after the delivery's own summary. */
export function linkedSummary(summary: string, result: CodeActivityResult): string {
  const { linked, notes = [] } = result;
  const done =
    linked === 0
      ? `${summary} · no issue matched`
      : `${summary} · ${linked} ${linked === 1 ? 'link' : 'links'} updated`;
  return [done, ...notes].join('. ');
}
