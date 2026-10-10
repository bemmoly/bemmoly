import type { AiFacade, AiPolicy, RequestContext, SqlExecutor } from '@bemmoly/core';
import { aiRefusal } from '@bemmoly/core';
import { ForbiddenError, NotFoundError } from '@bemmoly/shared';
import { spaceResource } from '../common.ts';

/*
 * Who may ask AI about a page, and whether the page may be sent at all. Every editor AI call
 * goes through here before a model is reached: edit rights on the page, AI on for the
 * person and their role allowed to use AI assist, the space not excluded (by Settings › AI or by the space's own switch), and the
 * workspace sharing content with AI, since every one of these calls sends page text.
 */

export interface GatedPage {
  id: string;
  spaceId: string;
  title: string;
  policy: AiPolicy;
}

interface PageAiRow {
  id: string;
  space_id: string;
  title: string;
  ai_excluded: boolean;
}

/** Share content off: the page body may not leave the install, so there is nothing to send. */
const notShared = () =>
  new ForbiddenError('This workspace does not share page text with AI', {
    details: { reason: 'excluded' },
  });

export async function gatePage(
  sql: SqlExecutor,
  ai: AiFacade,
  ctx: RequestContext,
  pageId: string,
): Promise<GatedPage> {
  const [row] = await sql<PageAiRow[]>`
    select p.id, p.space_id, p.title, s.ai_excluded
    from pages p join spaces s on s.id = p.space_id
    where p.id = ${pageId} and p.deleted_at is null`;
  if (!row) throw new NotFoundError('The page was not found');
  await ctx.authz.authorize(ctx.actor, 'docs.page.edit', spaceResource(row.space_id));
  const policy = await ai.policy(ctx.actor);
  if (!policy.enabled) throw aiRefusal('ai_off');
  if (policy.actorOptedOut) throw aiRefusal('opted_out');
  await ctx.authz.authorize(ctx.actor, 'ai.assist.use', { kind: 'workspace' });
  if (row.ai_excluded || !(await ai.maySend({ spaceId: row.space_id }, ctx.actor))) {
    throw aiRefusal('excluded');
  }
  if (!policy.shareContent) throw notShared();
  return { id: row.id, spaceId: row.space_id, title: row.title, policy };
}
