import { createHash } from 'node:crypto';
import type { Actor, ImportRunContext, SqlClient } from '@bemmoly/core';
import { fromConfluence, plainText, wordCount } from '@bemmoly/editor/convert';
import type { RichText } from '../../../../shared/common.ts';
import type { ConfluenceClient, ConfluencePage, ConfluenceUser } from '../../clients/confluence.ts';
import type { DocsServiceDeps } from '../common.ts';
import { bodyEdges, rewriteBodyLinks } from '../links/rewrite.ts';

/*
 * Page bodies: storage format converted with links resolved to the imported pages (by title,
 * as Confluence links them) and to issues, people resolved by account, unknown macros kept
 * as labelled blocks. A page whose text changed here since the last import is left alone and
 * reported; an untouched one is updated, through the live document when it has been opened.
 */

export interface BodyDeps {
  sql: SqlClient;
  entities?: DocsServiceDeps['entities'];
  /** Writes a page body through the collab host, so open editors see it. */
  replaceContent?: (pageId: string, snapshot: RichText, actor: Actor) => Promise<void>;
}

export interface BodyContext {
  ctx: ImportRunContext;
  client: ConfluenceClient;
  /** "space key|lower title" → page id, across every space of the run. */
  titles: Map<string, string>;
  /** Confluence page id → page id. */
  pages: Map<string, string>;
  people: Map<string, { id: string; label: string } | null>;
  siteHost: string;
}

const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 32);
const ACCOUNT = /ri:(?:account-id|userkey)="([^"]+)"/g;

export async function personFor(
  body: BodyContext,
  user: ConfluenceUser | undefined,
): Promise<string | null> {
  const sourceId = user?.accountId ?? user?.userKey ?? user?.username;
  if (!user || !sourceId) return null;
  const cached = body.people.get(sourceId);
  if (cached !== undefined) return cached?.id ?? null;
  const name = user.displayName ?? user.publicName ?? user.username ?? '';
  const id = await body.ctx.users.match({ sourceId, email: user.email ?? null, name });
  body.people.set(sourceId, id ? { id, label: name } : null);
  return id;
}

/** People a body mentions, looked up once each so mentions become links to them. */
async function resolveMentions(body: BodyContext, storage: string): Promise<void> {
  for (const [, account] of storage.matchAll(ACCOUNT)) {
    if (!account || body.people.has(account)) continue;
    try {
      const user = await body.client.user(account);
      await personFor(body, { ...user, accountId: user.accountId ?? account });
    } catch {
      body.people.set(account, null);
    }
  }
}

/** A link to a page or an issue on the same site, as its address here. */
function rewriteLink(body: BodyContext, href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.host.toLowerCase() !== body.siteHost) return null;
  const pageId =
    /\/pages\/(\d+)(?:\/|$)/.exec(url.pathname)?.[1] ?? url.searchParams.get('pageId') ?? null;
  const page = pageId ? body.pages.get(pageId) : undefined;
  if (page) return `/docs/p/${page}`;
  const issue = /\/browse\/([A-Z][A-Z0-9]{1,9}-\d+)$/.exec(url.pathname)?.[1];
  return issue ? `/work/issue/${issue}` : null;
}

export function convertBody(body: BodyContext, spaceKey: string, storage: string): RichText {
  return fromConfluence(storage, {
    resolvePage: (title, key) => {
      const pageId = body.titles.get(`${key || spaceKey}|${title.toLowerCase()}`);
      return pageId ? { pageId, title } : null;
    },
    resolveUser: (account) => body.people.get(account) ?? null,
    rewriteLink: (href) => rewriteLink(body, href),
  }) as RichText;
}

export async function writeBody(
  deps: BodyDeps,
  body: BodyContext,
  spaceKey: string,
  page: ConfluencePage,
  pageId: string,
): Promise<void> {
  const { ctx } = body;
  const mapped = await ctx.mappings.get('page', page.id);
  const version = page.version?.number ?? 0;
  const [current] = await deps.sql<{ text: string; title: string; logged: boolean }[]>`
    select text, title, exists(select 1 from page_updates u where u.page_id = p.id)
      or exists(select 1 from page_state s where s.page_id = p.id) as logged
    from pages p where p.id = ${pageId}`;
  if (!current) return;
  const textHash = mapped?.meta['textHash'];
  if (typeof textHash === 'string' && hash(current.text) !== textHash) {
    ctx.report.skip('page', page.title, 'Changed in Bemmoly since the last import; left as it is');
    return;
  }
  if (mapped?.meta['version'] === version && typeof textHash === 'string') {
    ctx.report.count('pages', 'skipped');
    return;
  }
  const storage = page.body?.storage?.value ?? '';
  await resolveMentions(body, storage);
  const snapshot = convertBody(body, spaceKey, storage);
  const readable = snapshot as Parameters<typeof plainText>[0];
  const text = plainText(readable);
  const actor: Actor = ctx.actorUserId
    ? { kind: 'user', id: ctx.actorUserId }
    : { kind: 'system', id: 'docs.import' };
  if (current.logged && deps.replaceContent) {
    await deps.replaceContent(pageId, snapshot, actor);
    await deps.sql`update pages set title = ${page.title.slice(0, 500)} where id = ${pageId}`;
  } else {
    await deps.sql`
      update pages set snapshot = ${JSON.stringify(snapshot)}::jsonb, text = ${text},
        word_count = ${wordCount(readable)}, title = ${page.title.slice(0, 500)},
        content_updated_at = now(), updated_at = now()
      where id = ${pageId}`;
  }
  await deps.sql.begin(async (tx) => {
    await rewriteBodyLinks(
      tx,
      pageId,
      await bodyEdges(deps.entities ? { entities: deps.entities } : {}, snapshot, pageId),
      ctx.actorUserId,
    );
  });
  const labels = (page.metadata?.labels?.results ?? [])
    .map((label) => label.name.trim().slice(0, 60))
    .filter(Boolean);
  if (labels.length) {
    await deps.sql`
      insert into page_labels (page_id, name, created_by)
      select ${pageId}, n, ${ctx.actorUserId}::uuid from unnest(${labels}::text[]) as n
      on conflict (page_id, lower(name)) do nothing`;
  }
  const placeholders = (JSON.stringify(snapshot).match(/"type":"unsupportedBlock"/g) ?? []).length;
  if (placeholders) ctx.report.count('macros kept as blocks', 'created', placeholders);
  await ctx.mappings.set('page', page.id, pageId, {
    spaceKey,
    version,
    textHash: hash(text),
  });
  ctx.report.count('pages', mapped?.meta['version'] === undefined ? 'created' : 'updated');
}
