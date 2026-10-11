import { defineWriteTool, type AiToolDefinition } from '@bemmoly/core';
import { z } from 'zod';
import { pageIdParamsSchema, pageTitleSchema, type RichText } from '../../../../shared/common.ts';
import type { DocsServices } from '../index.ts';
import {
  hasSpaceRef,
  markdownDocument,
  markdownSchema,
  pageHref,
  resolveSpace,
  SPACE_REF_MESSAGE,
  spaceRefShape,
} from './common.ts';

/*
 * Writing pages from Markdown, so an agent can file a service's docs into a space: one page
 * per document, a parent page per service as its folder. The body goes through the same
 * create and collab paths the editor uses, so search text, links and open editors follow.
 */

const createInput = z
  .object({
    ...spaceRefShape,
    parentId: z.uuid().optional(),
    title: pageTitleSchema.pipe(z.string().min(1)),
    body: markdownSchema.optional(),
  })
  .refine(hasSpaceRef, { message: SPACE_REF_MESSAGE });

const updateInput = pageIdParamsSchema
  .extend({
    title: pageTitleSchema.pipe(z.string().min(1)).optional(),
    body: markdownSchema.optional(),
  })
  .refine((input) => input.title !== undefined || input.body !== undefined, {
    message: 'Give a title or a body',
  });

type CreateInput = z.infer<typeof createInput>;
type UpdateInput = z.infer<typeof updateInput>;

interface UpdateUndo {
  pageId: string;
  title: string;
  snapshot: RichText | null;
}

const EMPTY_DOCUMENT: RichText = { type: 'doc', content: [{ type: 'paragraph' }] };

export function authoringTools(services: DocsServices): AiToolDefinition[] {
  const create = defineWriteTool<CreateInput, { pageId: string }>({
    name: 'docs_create_page',
    kind: 'write',
    description:
      'Create a page in a space (by spaceId or spaceKey) from a title and a Markdown body. ' +
      'Put it under parentId to nest it; a page with children is a folder, so create one ' +
      'parent page per service and its documents under it. Returns id, title, spaceKey, ' +
      'parentId and href; find spaces with docs_list_spaces and parents with docs_list_tree.',
    input: createInput,
    idempotent: false,
    describe: async (ctx, input) => {
      const space = await resolveSpace(services, ctx, input);
      return {
        target: space.key,
        change: input.title,
        field: null,
        from: null,
        to: null,
        href: null,
      };
    },
    authorize: async (ctx, input) => {
      const space = await resolveSpace(services, ctx, input);
      await ctx.authz.authorize(ctx.actor, 'docs.page.edit', {
        kind: 'space',
        id: space.id,
        moduleId: 'docs',
      });
    },
    run: async (ctx, input) => {
      const space = await resolveSpace(services, ctx, input);
      const page = await services.pages.create(ctx, {
        spaceId: space.id,
        parentId: input.parentId ?? null,
        title: input.title,
        ...(input.body ? { snapshot: markdownDocument(input.body) } : {}),
      });
      return {
        undo: { pageId: page.id },
        result: {
          id: page.id,
          title: page.title,
          spaceKey: page.spaceKey,
          parentId: page.parentId,
          href: pageHref(page.id),
        },
      };
    },
    undo: async (ctx, { pageId }) => {
      await services.pages.remove(ctx, pageId);
    },
  });

  const update = defineWriteTool<UpdateInput, UpdateUndo>({
    name: 'docs_update_page',
    kind: 'write',
    description:
      'Replace a page title and/or its whole body with Markdown. Read it first with ' +
      'docs_get_page (markdown: true) to keep what should stay. Returns id and title.',
    input: updateInput,
    idempotent: true,
    describe: async (ctx, { pageId, title, body }) => {
      const page = await services.pages.get(ctx, pageId);
      return {
        target: page.spaceKey,
        change: title ?? (page.title || 'Untitled'),
        field: body === undefined ? 'Title' : 'Content',
        from: body === undefined ? page.title : null,
        to: body === undefined ? (title ?? null) : null,
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
    run: async (ctx, { pageId, title, body }) => {
      const before = await services.pages.get(ctx, pageId);
      const page = await services.pages.update(ctx, pageId, {
        ...(title !== undefined ? { title } : {}),
        ...(body !== undefined ? { snapshot: markdownDocument(body) } : {}),
      });
      return {
        undo: {
          pageId,
          title: before.title,
          snapshot: body === undefined ? null : (before.snapshot ?? EMPTY_DOCUMENT),
        },
        result: { id: page.id, title: page.title },
      };
    },
    undo: async (ctx, { pageId, title, snapshot }) => {
      await services.pages.update(ctx, pageId, { title, ...(snapshot ? { snapshot } : {}) });
    },
  });

  return [create, update] as AiToolDefinition[];
}
