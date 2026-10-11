import {
  aiToolContribution,
  defineWriteTool,
  requestToolInput,
  type AiToolDefinition,
  type ModuleContext,
} from '@bemmoly/core';
import { z } from 'zod';
import { createCommentBodySchema } from '../../../../shared/comments.ts';
import { pageIdParamsSchema } from '../../../../shared/common.ts';
import { setStatusBodySchema } from '../../../../shared/status.ts';
import type { DocsServices } from '../index.ts';
import { authoringTools } from './authoring.ts';
import { browseTools } from './browse.ts';
import { pageHref } from './common.ts';

/*
 * What Docs offers the ⌘K planner and MCP clients: browse and read spaces and pages
 * (browse.ts), write pages from Markdown (authoring.ts), move a page through the review flow,
 * and leave a comment. Each goes through the service the page screen calls, as the person.
 */

const STATUS_NAMES: Readonly<Record<string, string>> = {
  draft: 'Draft',
  in_review: 'In review',
  published: 'Published',
  archived: 'Archived',
};

const statusInput = requestToolInput(pageIdParamsSchema, setStatusBodySchema);
const commentInput = requestToolInput(
  pageIdParamsSchema,
  createCommentBodySchema.omit({ body: true, parentId: true, anchor: true }),
).extend({ text: z.string().trim().min(1).max(2000) });

const paragraph = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

export function docsAiTools(services: DocsServices): AiToolDefinition[] {
  const review = [
    defineWriteTool<z.infer<typeof statusInput>, { pageId: string; status: string }>({
      name: 'docs_set_page_status',
      kind: 'write',
      description:
        'Move a page through review: draft, in_review (needs a reviewer), published or archived.',
      input: statusInput,
      idempotent: true,
      describe: async (ctx, { pageId, status }) => {
        const page = await services.pages.get(ctx, pageId);
        return {
          target: page.spaceKey,
          change: page.title || 'Untitled',
          field: null,
          from: STATUS_NAMES[page.status] ?? page.status,
          to: STATUS_NAMES[status] ?? status,
          href: pageHref(page.id),
        };
      },
      authorize: async (ctx, { pageId, status }) => {
        const page = await services.pages.get(ctx, pageId);
        const capability =
          status === 'published' || status === 'archived' ? 'docs.page.publish' : 'docs.page.edit';
        await ctx.authz.authorize(ctx.actor, capability, {
          kind: 'space',
          id: page.spaceId,
          moduleId: 'docs',
        });
      },
      run: async (ctx, { pageId, status, note }) => {
        const before = await services.pages.get(ctx, pageId);
        await services.status.setStatus(ctx, pageId, {
          status,
          note: note ?? `Changed by a plan, ${ctx.attribution}`,
        });
        return { undo: { pageId, status: before.status } };
      },
      undo: async (ctx, { pageId, status }) => {
        await services.status.setStatus(ctx, pageId, {
          status: setStatusBodySchema.shape.status.parse(status),
        });
      },
    }),
    defineWriteTool<z.infer<typeof commentInput>, { commentId: string }>({
      name: 'docs_add_page_comment',
      kind: 'write',
      description: 'Leave a short page comment in plain words; Bemmoly signs it for the person.',
      input: commentInput,
      idempotent: false,
      describe: async (ctx, { pageId, text }) => {
        const page = await services.pages.get(ctx, pageId);
        return {
          target: page.spaceKey,
          change: text,
          field: 'Comment',
          from: null,
          to: null,
          href: pageHref(page.id),
        };
      },
      authorize: async (ctx, { pageId }) => {
        const page = await services.pages.get(ctx, pageId);
        await ctx.authz.authorize(ctx.actor, 'docs.page.edit', {
          kind: 'space',
          id: page.spaceId,
          moduleId: 'docs',
        });
      },
      run: async (ctx, { pageId, text }) => {
        const comment = await services.comments.create(ctx, pageId, {
          body: paragraph(`${text} — ${ctx.attribution}`),
        });
        return { undo: { commentId: comment.id } };
      },
      undo: async (ctx, { commentId }) => {
        await services.comments.remove(ctx, commentId);
      },
    }),
  ];
  return [...browseTools(services), ...authoringTools(services), ...(review as AiToolDefinition[])];
}

/** Registers Docs' planner tools with the kernel; the kernel never imports Docs. */
export function registerDocsAiTools(ai: ModuleContext['ai'], services: DocsServices): void {
  for (const tool of docsAiTools(services)) ai.addTool(aiToolContribution(tool));
}
