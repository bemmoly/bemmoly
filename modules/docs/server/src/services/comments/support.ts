import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import {
  DOCS_REALTIME_KINDS,
  publishChange,
  recordAudit,
  type DocsServiceDeps,
} from '../common.ts';

/** Open pages refetch their comments; scoped to the space, carrying the page id. */
export async function announce(
  deps: Pick<DocsServiceDeps, 'realtime'>,
  spaceId: string,
  pageId: string,
): Promise<void> {
  await publishChange(deps, DOCS_REALTIME_KINDS.comments, spaceId, [pageId]);
}

/** One audit row per comment write, targeting the comment. */
export async function auditComment(
  deps: Pick<DocsServiceDeps, 'audit'>,
  ctx: RequestContext,
  tx: SqlExecutor,
  action: string,
  commentId: string,
  after: Record<string, unknown>,
): Promise<void> {
  await recordAudit(deps, ctx, { action, kind: 'page_comment', id: commentId, after }, tx);
}
