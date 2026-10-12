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
import { writeVersions } from './versions.ts';

/*
 * A Confluence run: every picked space and its page tree first, so links between spaces
 * resolve; then each space's bodies, comments and attachments a page of results at a time.
 * The checkpoint names the space and the offset reached; pages are idempotent anyway.
 */

/** A space's own checkpoint: the offset its bodies reached. */
interface Checkpoint {
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
  const body: BodyContext = {
    ctx,
    client,
    titles: new Map(),
    pages: new Map(),
    people: new Map(),
    siteHost: new URL(parsed.baseUrl).host,
    attachments: new Map(),
  };
  const todo = await ctx.containers.list();
  const targets = new Map<string, string>();
  // First pass: every space and its page tree, so links between spaces resolve.
  for (const container of todo) {
    await ctx.containers.run(
      container,
      async (scope) => {
        const space = spaces.find((entry) => entry.key === container.id);
        if (!space) throw new Error('The token no longer sees this space');
        await scope.progress.phase('Page tree', container.count ?? 0);
        const target = await ensureSpace(deps, space, ctx);
        targets.set(space.key, target.id);
        const tree = await writeTree(deps, client, { sourceKey: space.key, id: target.id }, ctx);
        for (const [sourceId, page] of tree) {
          body.pages.set(sourceId, page.id);
          body.titles.set(`${space.key}|${page.title.toLowerCase()}`, page.id);
        }
      },
      { final: false },
    );
  }
  // Second pass: bodies, comments and attachments, a page of results at a time.
  for (const container of todo) {
    const targetId = targets.get(container.id);
    if (!targetId) continue;
    await ctx.containers.run(container, async (scope) => {
      await scope.progress.phase('Pages', await client.countPages(container.id));
      let start: number | null = scope.checkpoint.read<Checkpoint>()?.start ?? 0;
      while (start !== null) {
        ctx.signal.throwIfAborted();
        const page = await client.pages(container.id, start, true);
        for (const item of page.results) {
          const pageId = body.pages.get(item.id);
          if (!pageId) continue;
          body.attachments = ctx.include.attachments
            ? await copyAttachments(body, item.id, pageId)
            : new Map();
          await writeBody(deps, body, container.id, item, pageId);
          if (ctx.include.history) {
            await writeVersions(deps.sql, body, container.id, item, pageId);
          }
          if (ctx.include.comments) {
            await writeComments(deps.sql, body, container.id, item.id, pageId);
          }
          await scope.progress.advance();
        }
        start = page.next;
        await scope.checkpoint.save({ start: start ?? 0 } satisfies Checkpoint);
      }
    });
  }
}
