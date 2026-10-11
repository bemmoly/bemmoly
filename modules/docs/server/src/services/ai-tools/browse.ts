import { defineReadTool, type AiToolDefinition, type RequestContext } from '@bemmoly/core';
import { z } from 'zod';
import { pageIdParamsSchema } from '../../../../shared/common.ts';
import type { PageSummary } from '../../../../shared/pages.ts';
import { searchPagesQuerySchema } from '../../../../shared/search.ts';
import { listSpacesQuerySchema } from '../../../../shared/spaces.ts';
import { treeQuerySchema } from '../../../../shared/tree.ts';
import type { DocsServices } from '../index.ts';
import {
  bodyMarkdown,
  hasSpaceRef,
  resolveSpace,
  SPACE_REF_MESSAGE,
  spaceRefShape,
} from './common.ts';

/*
 * Finding your way around Docs: the spaces a person can open, a space's page tree, search,
 * and one page. Every read goes through the service the screens call, as the person.
 */

/** Enough for any space an agent should walk in one call; past it, walk a subtree. */
export const TREE_PAGE_CAP = 2000;

const SPACES_CAP = 500;

const treeInput = z
  .object({
    ...spaceRefShape,
    parentId: z.uuid().optional(),
    recursive: z.boolean().default(true),
  })
  .refine(hasSpaceRef, { message: SPACE_REF_MESSAGE });

const getPageInput = pageIdParamsSchema.extend({
  markdown: z.boolean().default(false),
});

interface TreeEntry {
  id: string;
  parentId: string | null;
  title: string;
  status: string;
  depth: number;
  hasChildren: boolean;
}

const toEntry = (page: PageSummary): TreeEntry => ({
  id: page.id,
  parentId: page.parentId,
  title: page.title,
  status: page.status,
  depth: page.depth,
  hasChildren: page.hasChildren,
});

/** Every live page under a parent (or the roots), depth first in sibling order, capped. */
async function walkTree(
  services: DocsServices,
  ctx: RequestContext,
  spaceKey: string,
  parentId: string | undefined,
  recursive: boolean,
): Promise<{ pages: TreeEntry[]; truncated: boolean }> {
  const pages: TreeEntry[] = [];
  let truncated = false;
  const children = async (parent: string | undefined): Promise<PageSummary[]> => {
    const level: PageSummary[] = [];
    let cursor: string | undefined;
    do {
      const page = await services.tree.children(
        ctx,
        spaceKey,
        treeQuerySchema.parse({ parentId: parent, cursor, limit: 200 }),
      );
      level.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor && pages.length + level.length < TREE_PAGE_CAP);
    if (cursor) truncated = true;
    return level;
  };
  const visit = async (parent: string | undefined): Promise<void> => {
    for (const page of await children(parent)) {
      if (pages.length >= TREE_PAGE_CAP) {
        truncated = true;
        return;
      }
      pages.push(toEntry(page));
      if (recursive && page.hasChildren) await visit(page.id);
    }
  };
  await visit(parentId);
  return { pages, truncated };
}

export function browseTools(services: DocsServices): AiToolDefinition[] {
  const tools = [
    defineReadTool({
      name: 'docs_list_spaces',
      kind: 'read',
      description:
        'The Docs spaces this person can open: id, key (e.g. "ENG"), name, description and ' +
        'page count. Start here to find where to read or write pages.',
      input: z.object({}),
      execute: async (ctx) => {
        const spaces = [];
        let cursor: string | undefined;
        do {
          const page = await services.spaces.list(
            ctx,
            listSpacesQuerySchema.parse({ cursor, limit: 200 }),
          );
          spaces.push(...page.items);
          cursor = page.nextCursor ?? undefined;
        } while (cursor && spaces.length < SPACES_CAP);
        return spaces.map((space) => ({
          id: space.id,
          key: space.key,
          name: space.name,
          description: space.description,
          pageCount: space.pageCount,
        }));
      },
    }),
    defineReadTool({
      name: 'docs_list_tree',
      kind: 'read',
      description:
        'The page tree of a space (spaceId or spaceKey), or under parentId: every live page ' +
        'with id, parentId, title, status, depth and hasChildren, in order. A page with ' +
        `children is a folder. Walks the whole subtree unless recursive is false; stops at ` +
        `${TREE_PAGE_CAP} pages and says truncated.`,
      input: treeInput,
      execute: async (ctx, input) => {
        const space = await resolveSpace(services, ctx, input);
        const walked = await walkTree(services, ctx, space.key, input.parentId, input.recursive);
        return { spaceId: space.id, spaceKey: space.key, ...walked };
      },
    }),
    defineReadTool({
      name: 'docs_search_pages',
      kind: 'read',
      description:
        'Find pages by words in their title, labels or text, or every page of a space whose ' +
        'key or name is the query. Returns id, title, space, status. To browse a space, use ' +
        'docs_list_spaces and docs_list_tree instead.',
      input: searchPagesQuerySchema,
      execute: async (ctx, query) =>
        (await services.search.search(ctx, query)).map((hit) => ({
          id: hit.id,
          title: hit.title,
          space: hit.spaceName,
          spaceKey: hit.spaceKey,
          status: hit.status,
        })),
    }),
    defineReadTool({
      name: 'docs_get_page',
      kind: 'read',
      description:
        'One page by id: title, status, space, parent, owner, labels and its TL;DR. With ' +
        'markdown: true, also its body as Markdown, to compare before docs_update_page.',
      input: getPageInput,
      execute: async (ctx, { pageId, markdown }) => {
        const page = await services.pages.get(ctx, pageId);
        return {
          id: page.id,
          title: page.title,
          status: page.status,
          spaceKey: page.spaceKey,
          parentId: page.parentId,
          owner: page.owner?.name ?? null,
          labels: page.labels,
          tldr: page.tldr,
          wordCount: page.wordCount,
          ...(markdown ? { markdown: bodyMarkdown(page.snapshot) } : {}),
        };
      },
    }),
  ];
  return tools as AiToolDefinition[];
}
