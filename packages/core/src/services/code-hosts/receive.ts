import { NotFoundError, UnauthenticatedError, type CodeWebhookReceipt } from '@bemmoly/shared';
import { codeHostDriver } from './registry.ts';
import { dispatchActivities, linkedSummary, type CodeHostRuntime } from './runtime.ts';
import {
  claimDelivery,
  finishDelivery,
  integrationById,
  noteHostError,
  openHostSecrets,
  type IntegrationRow,
} from './store.ts';
import type { CodeHostDriver, ParsedDelivery, WebhookRequest } from './types.ts';

const REFUSED = 'A delivery was refused: its signature did not match the webhook secret';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * One verified delivery, applied at most once: the host's delivery id is claimed before
 * anything is linked, so a redelivery answers "duplicate" and changes nothing. A delivery
 * that failed may be claimed again, so the host's own retry repairs it.
 */
export async function applyDelivery(
  rt: CodeHostRuntime,
  row: IntegrationRow,
  driver: CodeHostDriver,
  request: WebhookRequest,
): Promise<CodeWebhookReceipt> {
  const deliveryId = driver.deliveryId(request);
  let parsed: ParsedDelivery;
  try {
    parsed = driver.parse(request);
  } catch (error) {
    const claimed = await claimDelivery(rt.sql, {
      integrationId: row.id,
      deliveryId,
      event: 'unreadable',
      action: null,
    });
    if (claimed) {
      await finishDelivery(rt.sql, claimed, {
        outcome: 'failed',
        summary: 'The delivery could not be read',
        error: messageOf(error),
      });
    }
    throw error;
  }
  const claimed = await claimDelivery(rt.sql, {
    integrationId: row.id,
    deliveryId,
    event: parsed.event,
    action: parsed.action,
  });
  if (!claimed) return { outcome: 'duplicate' };
  if (parsed.ping || parsed.activities.length === 0) {
    const outcome = parsed.ping ? 'test' : 'ignored';
    await finishDelivery(rt.sql, claimed, { outcome, summary: parsed.summary });
    await noteHostError(rt.sql, row.id, null);
    return { outcome };
  }
  try {
    const result = await dispatchActivities(rt, row, parsed.activities);
    await finishDelivery(rt.sql, claimed, {
      outcome: 'processed',
      summary: linkedSummary(parsed.summary, result),
    });
    await noteHostError(rt.sql, row.id, null);
    return { outcome: 'processed' };
  } catch (error) {
    await finishDelivery(rt.sql, claimed, {
      outcome: 'failed',
      summary: parsed.summary,
      error: messageOf(error),
    });
    await noteHostError(rt.sql, row.id, `A delivery failed: ${messageOf(error)}`.slice(0, 500));
    rt.logger?.error({ err: error, integrationId: row.id }, 'code host delivery failed');
    throw error;
  }
}

/**
 * The webhook route's work: the integration, then the signature over the untouched bytes,
 * and only then the body. A refused signature is noted on the host (so Settings can say so)
 * but never stored as a delivery, so a stranger cannot fill the log.
 */
export async function receiveWebhook(
  rt: CodeHostRuntime,
  integrationId: string,
  request: WebhookRequest,
): Promise<CodeWebhookReceipt> {
  const row = await integrationById(rt.sql, integrationId);
  if (!row.enabled) throw new NotFoundError('The code host is not connected');
  const driver = codeHostDriver(row.kind);
  const { webhookSecret } = openHostSecrets(rt.secrets, row);
  if (!driver.verify(request, webhookSecret)) {
    await noteHostError(rt.sql, row.id, REFUSED);
    throw new UnauthenticatedError('The delivery signature does not match the webhook secret');
  }
  return applyDelivery(rt, row, driver, request);
}
