import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { collectReferences } from '@bemmoly/editor/convert';
import { NOTIFICATION_EVENT_KINDS, type NotificationRequestedPayload } from '@bemmoly/shared';
import type { RichText } from '../../../../shared/common.ts';
import { spaceResource, userIdOf, type DocsServiceDeps } from '../common.ts';
import { pagePath } from '../palette/index.ts';

/*
 * Who hears of a comment, as Work's comments do: a mention reaches the person named; a reply
 * reaches everyone else in the thread; a new thread reaches the page's owner. Each request is
 * a `notification.requested` event in the caller's transaction, which the kernel turns into
 * inbox rows and emails, so a rolled back comment tells nobody. Nobody hears of their own
 * comment, and nobody hears of a page they cannot open.
 */

export interface CommentNotice {
  kind: 'mention' | 'comment';
  recipientIds: readonly string[];
  /** Stable per logical event, so a retried request never writes twice. */
  dedupeKey: string;
}

export interface NoticePage {
  id: string;
  spaceId: string;
  title: string;
  commentId: string;
  text: string;
}

/** People a comment body names with a mention node, each once. */
export function mentionedIds(body: RichText | null | undefined): string[] {
  const refs = collectReferences(body as Parameters<typeof collectReferences>[0]);
  return [...new Set(refs.flatMap((ref) => (ref.kind === 'user' ? [ref.id] : [])))];
}

/**
 * One set-based check on the transaction: a check per recipient on the pool would hold the
 * comment's connection while waiting for another, and starve the pool under load.
 */
function whoMayOpen(
  ctx: RequestContext,
  tx: SqlExecutor,
  spaceId: string,
  ids: readonly string[],
): Promise<string[]> {
  return ctx.authz.within(tx).whoCan(ids, 'docs.page.view', spaceResource(spaceId));
}

export async function notifyComment(
  deps: Pick<DocsServiceDeps, 'events'>,
  ctx: RequestContext,
  tx: SqlExecutor,
  page: NoticePage,
  notice: CommentNotice,
): Promise<void> {
  if (!deps.events) return;
  const actorId = userIdOf(ctx);
  const candidates = [...new Set(notice.recipientIds)].filter((id) => id !== actorId);
  const recipientIds = await whoMayOpen(ctx, tx, page.spaceId, candidates);
  if (recipientIds.length === 0) return;
  const [actor] = actorId
    ? await tx<{ name: string }[]>`select name from users where id = ${actorId}`
    : [];
  const payload: NotificationRequestedPayload = {
    kind: notice.kind,
    recipientIds,
    ...(actorId ? { actorId } : {}),
    ...(actor?.name ? { actorName: actor.name } : {}),
    target: {
      kind: 'page',
      id: page.id,
      label: page.title || 'Untitled',
      url: `${pagePath(page.id)}#comment-${page.commentId}`,
    },
    body: page.text.slice(0, 500),
    dedupeKey: notice.dedupeKey,
  };
  await deps.events.publish({
    kind: NOTIFICATION_EVENT_KINDS.notificationRequested,
    occurredAt: new Date(),
    actor: ctx.actor,
    entity: { kind: 'page', id: page.id },
    payload,
    transaction: tx,
  });
}

/** Everyone else in a thread: the opening comment's author and every replier. */
export async function threadPeople(tx: SqlExecutor, threadId: string): Promise<string[]> {
  const rows = await tx<{ author_id: string }[]>`
    select distinct author_id from page_comments
    where (id = ${threadId} or parent_id = ${threadId})
      and deleted_at is null and author_id is not null`;
  return rows.map((row) => row.author_id);
}
