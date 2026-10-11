import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { NOTIFICATION_EVENT_KINDS, type NotificationRequestedPayload } from '@bemmoly/shared';
import type { RichText } from '../../../../shared/common.ts';
import { WORK_REALTIME_KINDS } from '../../../../shared/realtime.ts';
import { mentionedUserIds } from '../../../../shared/rich-text.ts';
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

export const issuePath = (key: string): string => `/work/issue/${key}`;

/** How inboxes name an automation rule's notifications. */
export const AUTOMATION_ACTOR_NAME = 'Automation';

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

export type NotificationKind =
  'assignment' | 'mention' | 'comment' | 'status_change' | 'watch_update';

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
 * and the email carry the key, the title and the comment. One set-based check
 * on the transaction: a check per recipient on the pool would hold this
 * transaction's connection while waiting for another, and starve the pool.
 */
function whoMayOpen(
  ctx: RequestContext,
  tx: SqlExecutor,
  projectId: string,
  userIds: readonly string[],
): Promise<string[]> {
  return ctx.authz.within(tx).whoCan(userIds, 'work.issue.view', projectResource(projectId));
}

export async function notify(
  deps: Pick<IssueServiceDeps, 'events' | 'now'>,
  ctx: RequestContext,
  tx: SqlExecutor,
  issue: IssueRef,
  notice: Notice,
): Promise<void> {
  // A rule's owner hears of what the rule did; a person never hears of their own change.
  const automated = ctx.actor.kind === 'automation';
  const actorId = automated ? null : actorUserId(ctx);
  const recipientIds = await whoMayOpen(
    ctx,
    tx,
    issue.projectId,
    [...new Set(notice.recipientIds)].filter((id) => id !== actorId),
  );
  if (recipientIds.length === 0) return;
  const name = automated ? AUTOMATION_ACTOR_NAME : await actorName(tx, actorId);
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

/**
 * The people a description names for the first time: a mention in the
 * description reaches them as one in a comment does, once, not on every
 * later edit that keeps it.
 */
export async function notifyDescriptionMentions(
  deps: Pick<IssueServiceDeps, 'events' | 'now'>,
  ctx: RequestContext,
  tx: SqlExecutor,
  issue: IssueRef & { title: string; description: RichText | null; updatedAt: string },
  previous: RichText | null,
): Promise<void> {
  const before = new Set(mentionedUserIds(previous));
  const named = mentionedUserIds(issue.description).filter((id) => !before.has(id));
  if (named.length === 0) return;
  await notify(deps, ctx, tx, issue, {
    kind: 'mention',
    recipientIds: named,
    body: issue.title,
    dedupeKey: `issue:${issue.id}:description-mention:${issue.updatedAt}`,
  });
}
