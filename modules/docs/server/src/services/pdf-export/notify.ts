import { NOTIFICATION_EVENT_KINDS, type NotificationRequestedPayload } from '@bemmoly/shared';
import type { DocsServiceDeps } from '../common.ts';
import { exportFilePath } from './rows.ts';

/** Tells the person who asked that their PDF is ready, with the link that downloads it. */
export async function notifyExportReady(
  deps: Pick<DocsServiceDeps, 'events'>,
  input: { id: string; pageId: string; requested_by: string; title: string; pages: number },
): Promise<void> {
  if (!deps.events) return;
  const label = input.title || 'Untitled';
  const payload: NotificationRequestedPayload = {
    kind: 'docs.export_ready',
    recipientIds: [input.requested_by],
    target: { kind: 'page_export', id: input.id, label, url: exportFilePath(input.id) },
    body:
      input.pages > 1
        ? `The PDF of “${label}” and the ${input.pages - 1} pages under it is ready to download.`
        : `The PDF of “${label}” is ready to download.`,
    reason: 'you exported it',
    dedupeKey: `docs.export_ready:${input.id}`,
  };
  await deps.events.publish({
    kind: NOTIFICATION_EVENT_KINDS.notificationRequested,
    occurredAt: new Date(),
    actor: { kind: 'system', id: 'docs.export-pdf' },
    entity: { kind: 'page', id: input.pageId },
    payload,
  });
}
