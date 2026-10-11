import type { ImportConnection, ImportRunContext } from '@bemmoly/core';
import type { ImportPlan } from '@bemmoly/shared';
import { writeBody, type BodyContext, type BodyDeps } from './bodies.ts';
import {
  confluenceClientFor,
  explainConfluenceError,
  parseConfluenceConnection,
} from './connection.ts';
import { copyAttachments, writeComments } from './extras.ts';
import { ensureSpace, writeTree, type TreeDeps } from './tree.ts';

/*
 * A Confluence run: every picked space and its page tree first, so links between spaces
 * resolve; then each space's bodies, comments and attachments a page of results at a time.
 * The checkpoint names the space and the offset reached; pages are idempotent anyway.
 */

interface Checkpoint {
  space: number;
  start: number;
}

export type ConfluenceRunDeps = TreeDeps & BodyDeps;

export async function runConfluence(
  deps: ConfluenceRunDeps,
  connection: ImportConnection,
  plan: ImportPlan,
  ctx: ImportRunContext,
): Promise<void> {
  const parsed = parseConfluenceConnection(connection);
  const client = confluenceClientFor(connection, ctx);
  let spaces;
  try {
    spaces = (await client.spaces()).filter((space) => plan.containers.includes(space.key));
  } catch (error) {
    return explainConfluenceError(error);
  }
  for (const key of plan.containers) {
    if (!spaces.some((space) => space.key === key)) {
      ctx.report.skip('space', key, 'No longer visible to the token');
    }
  }
  const body: BodyContext = {
    ctx,
    client,
    titles: new Map(),
    pages: new Map(),
    people: new Map(),
    siteHost: new URL(parsed.baseUrl).host,
  };
  const targets: { key: string; id: string }[] = [];
  for (const space of spaces) {
    const target = await ensureSpace(deps, space, ctx);
    targets.push({ key: space.key, id: target.id });
    const tree = await writeTree(deps, client, { sourceKey: space.key, id: target.id }, ctx);
    for (const [sourceId, page] of tree) {
      body.pages.set(sourceId, page.id);
      body.titles.set(`${space.key}|${page.title.toLowerCase()}`, page.id);
    }
  }
  const saved = ctx.checkpoint.read<Checkpoint>();
  for (const [index, space] of targets.entries()) {
    if (saved && index < saved.space) continue;
    await ctx.progress.phase(`Pages in ${space.key}`, await client.countPages(space.key));
    let start: number | null = saved && saved.space === index ? saved.start : 0;
    if (start) await ctx.progress.advance(start);
    while (start !== null) {
      ctx.signal.throwIfAborted();
      const page = await client.pages(space.key, start, true);
      for (const item of page.results) {
        const pageId = body.pages.get(item.id);
        if (!pageId) continue;
        await writeBody(deps, body, space.key, item, pageId);
        await writeComments(deps.sql, body, space.key, item.id, pageId);
        await copyAttachments(body, item.id, pageId);
        await ctx.progress.advance();
      }
      start = page.next;
      await ctx.checkpoint.save({ space: start === null ? index + 1 : index, start: start ?? 0 });
    }
  }
}
