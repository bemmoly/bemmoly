import type { EventBus, RequestContext, SqlExecutor } from '@bemmoly/core';
import { NOTIFICATION_EVENT_KINDS, type NotificationRequestedPayload } from '@bemmoly/shared';
import type { ChangeRequestEventRow } from '../../models/change-requests.ts';
import { PIPELINES_RESOURCE, personOf } from '../deps.ts';

/*
 * What a change request leaves behind: one activity row per thing that happened (the detail
 * screen's Activity card reads them back as sentences), and inbox notifications for the
 * people who must act or should know, through the kernel's notification.requested event so
 * each person's preference decides on email.
 */

export type ActivityKind =
  | 'created'
  | 'sent'
  | 'edited'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'withdrawn'
  | 'step_ready'
  | 'all_approved'
  | 'waiting_for_window'
  | 'deploy_started'
  | 'deployed'
  | 'failed'
  | 'emergency';

export async function recordActivity(
  tx: SqlExecutor,
  requestId: string,
  userId: string | null,
  kind: ActivityKind,
  data: Record<string, unknown>,
  at: Date,
): Promise<void> {
  await tx`
    insert into pipeline_change_request_events
      (change_request_id, user_id, kind, data, created_at, updated_at)
    values (${requestId}, ${userId}, ${kind}, ${JSON.stringify(data)}::jsonb,
      ${at.toISOString()}::timestamptz, ${at.toISOString()}::timestamptz)`;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

/** One activity row as a sentence; the actor's name leads it on screen. */
export function activityText(row: ChangeRequestEventRow): string {
  const d = row.data;
  const note = str(d['note']) ? `: "${str(d['note'])}"` : '';
  switch (row.kind) {
    case 'created':
      return 'saved a draft.';
    case 'sent': {
      const picked = Array.isArray(d['picked']) ? (d['picked'] as string[]).join(', ') : '';
      return picked ? `asked for approval and picked ${picked}.` : 'asked for approval.';
    }
    case 'edited':
      return 'edited the request.';
    case 'approved':
      return `approved as one of ${str(d['group'])}${note}.`;
    case 'rejected':
      return `rejected it as one of ${str(d['group'])}${note}.`;
    case 'changes_requested':
      return `asked for changes${note}.`;
    case 'withdrawn':
      return `withdrew it${note}.`;
    case 'step_ready':
      return `${str(d['group'])} can approve now.`;
    case 'all_approved':
      return 'Every approval is in.';
    case 'waiting_for_window':
      return `The deploy waits for ${str(d['until']) || 'the deploy window'}.`;
    case 'deploy_started':
      return `Promote started deploying to ${str(d['environment'])}.`;
    case 'deployed':
      return `Deployed to ${str(d['environment'])}.`;
    case 'failed':
      return `The deploy to ${str(d['environment'])} did not finish${note}.`;
    case 'emergency':
      return `deployed without approval${note}.`;
    default:
      return row.kind;
  }
}

export interface Notice {
  kind: string;
  recipientIds: readonly string[];
  body: string;
  dedupeKey: string;
}

export interface NotifyDeps {
  events?: Pick<EventBus, 'publish'>;
  now: () => Date;
}

export const changeRequestPath = (number: string) => `/pipelines/changes/CHG-${number}`;

/** Inbox rows for people who may use Pipelines, never for the person who acted. */
export async function notify(
  deps: NotifyDeps,
  ctx: RequestContext,
  tx: SqlExecutor,
  request: { id: string; number: string; title: string },
  notice: Notice,
): Promise<void> {
  if (!deps.events) return;
  const actorId = personOf(ctx.actor);
  const wanted = [...new Set(notice.recipientIds)].filter((id) => id !== actorId);
  if (wanted.length === 0) return;
  const recipientIds = await ctx.authz
    .within(tx)
    .whoCan(wanted, 'pipelines.view', PIPELINES_RESOURCE);
  if (recipientIds.length === 0) return;
  const [actor] = actorId
    ? await tx<{ name: string }[]>`select name from users where id = ${actorId}`
    : [];
  const payload: NotificationRequestedPayload = {
    kind: notice.kind,
    recipientIds,
    ...(actorId ? { actorId } : {}),
    ...(actor ? { actorName: actor.name } : {}),
    target: {
      kind: 'pipeline_change_request',
      id: request.id,
      label: `CHG-${request.number}`,
      url: changeRequestPath(request.number),
    },
    body: `${request.title}. ${notice.body}`.slice(0, 2000),
    dedupeKey: notice.dedupeKey,
  };
  await deps.events.publish({
    kind: NOTIFICATION_EVENT_KINDS.notificationRequested,
    occurredAt: deps.now(),
    actor: ctx.actor,
    entity: { kind: 'pipeline_change_request', id: request.id },
    payload,
    transaction: tx,
  });
}
