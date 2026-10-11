import type { ModuleContext, RequestContext } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import { toMarkdown } from '@bemmoly/editor/convert';
import { pageIdParamsSchema, type RichText } from '../../../../shared/common.ts';
import type { PageDetail } from '../../../../shared/pages.ts';
import { listSpacesQuerySchema } from '../../../../shared/spaces.ts';
import { treeQuerySchema } from '../../../../shared/tree.ts';
import type { DocsServices } from '../index.ts';
import { pagePath } from '../palette/index.ts';

/*
 * What Docs offers MCP clients besides its AI tools: spaces and pages as resources, a page's
 * text as Markdown, and a review prompt. Reads go through the services the screens call, as
 * the person behind the token.
 */

const pageUri = (id: string) => `bemmoly://docs/pages/${id}`;
const spaceUri = (key: string) => `bemmoly://docs/spaces/${encodeURIComponent(key)}`;

type Readable = Parameters<typeof toMarkdown>[0];

export function pageMarkdown(page: PageDetail): string {
  const body = toMarkdown(page.snapshot as RichText as Readable, { pageHref: pagePath });
  return [
    `# ${page.title || 'Untitled'}`,
    '',
    `- Space: ${page.spaceKey}`,
    `- Status: ${page.status}`,
    `- Owner: ${page.owner?.name ?? 'None'}`,
    ...(page.labels.length > 0 ? [`- Labels: ${page.labels.join(', ')}`] : []),
    ...(page.tldr ? ['', `> ${page.tldr}`] : []),
    '',
    body.trim() || '_This page is empty._',
    '',
  ].join('\n');
}

/** A page by id as the person sees it; an id that is not one answers like a missing page. */
async function readPage(services: DocsServices, ctx: RequestContext, pageId: string) {
  const parsed = pageIdParamsSchema.safeParse({ pageId });
  if (!parsed.success) throw new NotFoundError('Page not found');
  return services.pages.get(ctx, parsed.data.pageId);
}

/** Registers Docs' MCP resources and prompts with the kernel. */
export function registerDocsMcp(mcp: ModuleContext['mcp'], services: DocsServices): void {
  mcp.addResource({
    name: 'docs.space',
    title: 'Space',
    description: 'A Docs space by key: its description and top-level pages.',
    uriTemplate: 'bemmoly://docs/spaces/{key}',
    list: async (ctx) => {
      const page = await services.spaces.list(ctx, listSpacesQuerySchema.parse({ limit: 100 }));
      return page.items.map((space) => ({
        uri: spaceUri(space.key),
        name: space.key,
        title: space.name,
        ...(space.description ? { description: space.description } : {}),
      }));
    },
    read: async (ctx, { key = '' }) => {
      const space = await services.spaces.get(ctx, key);
      const roots = await services.tree.children(
        ctx,
        space.key,
        treeQuerySchema.parse({ limit: 100 }),
      );
      return {
        text: [
          `# ${space.name} (${space.key})`,
          '',
          space.description?.trim() || '_No description._',
          '',
          '## Pages',
          '',
          ...(roots.items.length > 0
            ? roots.items.map((page) => `- [${page.title || 'Untitled'}](${pageUri(page.id)})`)
            : ['_No pages yet._']),
          '',
        ].join('\n'),
      };
    },
  });
  mcp.addResource({
    name: 'docs.page',
    title: 'Page',
    description: 'A Docs page by id, as Markdown with its status, owner and TL;DR.',
    uriTemplate: 'bemmoly://docs/pages/{id}',
    read: async (ctx, { id = '' }) => ({ text: pageMarkdown(await readPage(services, ctx, id)) }),
  });
  mcp.addPrompt({
    name: 'docs.review_page',
    title: 'Review a page',
    description: 'Read a page and point out gaps, unclear parts and stale facts.',
    arguments: [{ name: 'pageId', description: 'The page id', required: true }],
    render: async (ctx, { pageId = '' }) => {
      const page = await readPage(services, ctx, pageId);
      return [
        {
          role: 'user',
          text:
            'Review this page as a careful colleague: list gaps, unclear parts and facts that ' +
            `look stale, most important first. Its resource is ${pageUri(page.id)}.\n\n` +
            pageMarkdown(page),
        },
      ];
    },
  });
}
