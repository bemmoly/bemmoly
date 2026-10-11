import {
  ForbiddenError,
  NOTIFICATION_EVENT_KINDS,
  type NotificationRequestedPayload,
} from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import { settingsOf, WEBHOOK_CAPABILITY, WORKSPACE, type WebhookDeps } from './context.ts';

const SYSTEM: Actor = { kind: 'system', id: 'webhooks' };

export const WEBHOOKS_PATH = '/settings/webhooks';

/** Active people who may manage webhooks; a workspace capability comes from the org role. */
async function webhookAdmins(deps: WebhookDeps): Promise<string[]> {
  const rows = await deps.sql<{ id: string; role_id: string }[]>`
    select id, role_id from users where status = 'active' order by id`;
  const byRole = new Map<string, string[]>();
  for (const row of rows) byRole.set(row.role_id, [...(byRole.get(row.role_id) ?? []), row.id]);
  const admins: string[] = [];
  for (const ids of byRole.values()) {
    const sample = ids[0]!;
    try {
      await deps.authorize({ kind: 'user', id: sample }, WEBHOOK_CAPABILITY, WORKSPACE);
      admins.push(...ids);
    } catch (error) {
      if (!(error instanceof ForbiddenError)) throw error;
    }
  }
  return admins;
}

/**
 * Turns a webhook off after `failures` failed deliveries in a row, records it in the audit
 * log and tells the admins in their inbox (and by email, at once by default). Only the first
 * caller to flip it does any of this, so two failing deliveries never tell twice.
 */
export async function disableFailingWebhook(
  deps: WebhookDeps,
  webhookId: string,
  failures: number,
): Promise<void> {
  const reason = `Turned off after ${failures} failed deliveries in a row`;
  const [row] = await deps.sql<{ name: string; url: string }[]>`
    update webhooks set enabled = false, disabled_reason = ${reason}, updated_at = now()
    where id = ${webhookId} and enabled
    returning name, url`;
  if (!row) return;
  deps.logger.warn({ webhookId, failures }, 'turned off a failing webhook');
  await deps.audit.record({
    actor: SYSTEM,
    action: 'webhook.disabled',
    target: { kind: 'webhook', id: webhookId },
    after: { enabled: false, reason },
  });
  const recipientIds = await webhookAdmins(deps);
  if (recipientIds.length === 0) return;
  const payload: NotificationRequestedPayload = {
    kind: 'webhook_disabled',
    recipientIds,
    target: { kind: 'webhook', id: webhookId, label: row.name, url: WEBHOOKS_PATH },
    body: `${reason}. Check ${new URL(row.url).host}, then turn the webhook back on in Settings › Webhooks.`,
    reason: 'you administer this workspace',
    dedupeKey: `webhook:${webhookId}:disabled:${settingsOf(deps).now().toISOString()}`,
  };
  await deps.events.publish({
    kind: NOTIFICATION_EVENT_KINDS.notificationRequested,
    occurredAt: settingsOf(deps).now(),
    actor: SYSTEM,
    entity: { kind: 'webhook', id: webhookId },
    payload,
  });
}
