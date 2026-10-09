import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import {
  ForbiddenError,
  NOTIFICATION_EVENT_KINDS,
  type NotificationRequestedPayload,
} from '@bemmoly/shared';
import { WORK_REALTIME_KINDS } from '../../../../shared/realtime.ts';
import { actorUserId, projectResource, type IssueServiceDeps } from './deps.ts';

/*
 * The side effects every issue mutation ends with: an invalidation for the
 * sockets and, when someone should hear of it, a `notification.requested`
 * event the kernel turns into inbox rows and outbox emails. Both join the
 * caller's transaction so a rolled back write tells nobody.
 */

export interface IssueRef {
  id: string;
  key: string;
  projectId: string;
  sprintId?: string | null;
}

export const issuePath = (key: string): string => `/work/issues/${key}`;

export async function publishIssueChange(
  deps: Pick<IssueServiceDeps, 'realtime'>,
  tx: SqlExecutor,
  issue: IssueRef,
  options: { board?: boolean; sprintIds?: readonly (string | null | undefined)[] } = {},
): Promise<void> {
  const publish = (message: Parameters<typeof deps.realtime.publish>[0]) =>
    deps.realtime.publish(message, { transaction: tx });
  await publish({ kind: WORK_REALTIME_KINDS.issue, ids: [issue.id], projectId: issue.projectId });
  if (options.board) {
    await publish({ kind: WORK_REALTIME_KINDS.board, ids: [issue.id], projectId: issue.projectId });
  }
  const sprintIds = [...new Set((options.sprintIds ?? [issue.sprintId]).filter(Boolean))];
  if (sprintIds.length > 0) {
    await publish({
      kind: WORK_REALTIME_KINDS.sprint,
      ids: sprintIds as string[],
      projectId: issue.projectId,
    });
  }
}

export type NotificationKind = 'assignment' | 'mention' | 'comment' | 'status_change';

export interface Notice {
  kind: NotificationKind;
  recipientIds: readonly string[];
  body: string;
  /** Stable per logical event so a retried request never writes twice. */
  dedupeKey: string;
}

async function actorName(tx: SqlExecutor, userId: string | null): Promise<string | undefined> {
  if (!userId) return undefined;
  const [row] = await tx<{ name: string }[]>`select name from users where id = ${userId}`;
  return row?.name;
}

/** Everyone watching the issue, so comments and transitions reach the right inboxes. */
export async function watcherIds(tx: SqlExecutor, issueId: string): Promise<string[]> {
  const rows = await tx<{ user_id: string }[]>`
    select user_id from watchers where target_kind = 'issue' and target_id = ${issueId}`;
  return rows.map((row) => row.user_id);
}

/**
 * The recipients who may open the issue. A mention names anyone and a watch
 * outlives a membership, but neither is a key to the project: the inbox row
 * and the email carry the key, the title and the comment.
 */
async function whoMayOpen(
  ctx: RequestContext,
  projectId: string,
  userIds: readonly string[],
): Promise<string[]> {
  const allowed: string[] = [];
  for (const id of userIds) {
    try {
      await ctx.authz.authorize(
        { kind: 'user', id },
        'work.issue.view',
        projectResource(projectId),
      );
      allowed.push(id);
    } catch (error) {
      if (!(error instanceof ForbiddenError)) throw error;
    }
  }
  return allowed;
}

export async function notify(
  deps: Pick<IssueServiceDeps, 'events' | 'now'>,
  ctx: RequestContext,
  tx: SqlExecutor,
  issue: IssueRef,
  notice: Notice,
): Promise<void> {
  const actorId = actorUserId(ctx);
  const recipientIds = await whoMayOpen(
    ctx,
    issue.projectId,
    [...new Set(notice.recipientIds)].filter((id) => id !== actorId),
  );
  if (recipientIds.length === 0) return;
  const name = await actorName(tx, actorId);
  const payload: NotificationRequestedPayload = {
    kind: notice.kind,
    recipientIds,
    ...(actorId ? { actorId } : {}),
    ...(name ? { actorName: name } : {}),
    target: { kind: 'issue', id: issue.id, label: issue.key, url: issuePath(issue.key) },
    body: notice.body,
    dedupeKey: notice.dedupeKey,
  };
  await deps.events.publish({
    kind: NOTIFICATION_EVENT_KINDS.notificationRequested,
    occurredAt: deps.now?.() ?? new Date(),
    actor: ctx.actor,
    entity: { kind: 'issue', id: issue.id },
    payload,
    transaction: tx,
  });
}
