import type { Actor, SqlExecutor } from '@bemmoly/core';
import { DOMAIN_EVENT_KINDS } from '@bemmoly/shared/webhooks';
import type { DocsServiceDeps } from '../common.ts';
import { pagePath } from '../palette/index.ts';
import { pageById } from './rows.ts';

type PageEventKind =
  typeof DOMAIN_EVENT_KINDS.pagePublished | typeof DOMAIN_EVENT_KINDS.pageUpdated;

const TITLE_CHARS = 200;

/**
 * page.published when a page is published, page.updated when its title or details change or
 * when an edit session settles into a revision (at most every half hour of editing), so a
 * webhook hears of real changes, not every keystroke. Joins the writer's transaction.
 */
export async function publishPageEvent(
  deps: Pick<DocsServiceDeps, 'events'>,
  tx: SqlExecutor,
  kind: PageEventKind,
  pageId: string,
  actor: Actor | undefined,
): Promise<void> {
  if (!deps.events) return;
  const page = await pageById(tx, pageId);
  const title =
    page.title.length > TITLE_CHARS ? `${page.title.slice(0, TITLE_CHARS)}…` : page.title;
  const verb = kind === DOMAIN_EVENT_KINDS.pagePublished ? 'was published' : 'was updated';
  await deps.events.publish({
    kind,
    occurredAt: new Date(),
    ...(actor ? { actor } : {}),
    entity: { kind: 'page', id: pageId },
    payload: {
      summary: `${title || 'Untitled'} ${verb}`,
      url: pagePath(pageId),
      page: {
        id: page.id,
        title,
        spaceId: page.space_id,
        spaceKey: page.space_key,
        status: page.status,
        version: page.version,
      },
    },
    transaction: tx,
  });
}
