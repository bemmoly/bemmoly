import { defineWriteTool, type AiToolDefinition } from '@bemmoly/core';
import { isUploadImageType } from '@bemmoly/shared';
import { z } from 'zod';
import { pageIdParamsSchema, type RichText } from '../../../../shared/common.ts';
import type { DocsServices } from '../index.ts';
import { pageHref } from './common.ts';

/*
 * An agent's file in a page: an HTML report it wrote, a PDF, an image. The bytes go through
 * the kernel's files API as the person, so the same sniffing, limits and sandbox apply as to
 * the editor's uploads. The MCP request body (1 MiB) caps what fits in one call.
 */

const CONTENT_MAX = 1_000_000;

const uploadInput = pageIdParamsSchema.extend({
  name: z.string().trim().min(1).max(255),
  content: z.string().min(1).max(CONTENT_MAX),
  encoding: z.enum(['utf8', 'base64']).default('utf8'),
  append: z.boolean().default(true),
});

type UploadInput = z.infer<typeof uploadInput>;

interface UploadUndo {
  pageId: string;
  /** The body before the file was added at its end; null when it was not added. */
  snapshot: RichText | null;
}

const EMPTY_DOCUMENT: RichText = { type: 'doc', content: [{ type: 'paragraph' }] };

export function fileTools(services: DocsServices): AiToolDefinition[] {
  const upload = defineWriteTool<UploadInput, UploadUndo>({
    name: 'docs_upload_file',
    kind: 'write',
    description:
      'Add a file to a page: an HTML page (send it as text), or a PDF or image (base64, ' +
      'encoding: "base64"). People see it as a preview they can expand to full screen; HTML ' +
      'runs sandboxed and may load scripts, styles and fonts over https but cannot fetch. ' +
      'With append (the default) it goes at the end of the page; with append: false, place ' +
      'the returned markdown (![name](url)) where it belongs with docs_update_page. For a ' +
      'page that is only the file, create it with docs_create_page and no body first. ' +
      'Returns id, url, name, mime and markdown.',
    input: uploadInput,
    idempotent: false,
    describe: async (ctx, { pageId, name }) => {
      const page = await services.pages.get(ctx, pageId);
      return {
        target: page.spaceKey,
        change: page.title || 'Untitled',
        field: 'File',
        from: null,
        to: name,
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
    run: async (ctx, { pageId, name, content, encoding, append }) => {
      const stored = await services.attachments.upload(
        ctx,
        pageId,
        name,
        Buffer.from(content, encoding),
      );
      const markdown = `![${stored.name.replace(/[[\]]/g, '')}](${stored.url})`;
      let snapshot: RichText | null = null;
      if (append) {
        const before = await services.pages.get(ctx, pageId);
        snapshot = before.snapshot ?? EMPTY_DOCUMENT;
        const content = (snapshot as { content?: unknown[] }).content ?? [];
        const block = isUploadImageType(stored.mime)
          ? { type: 'image', attrs: { src: stored.url, alt: stored.name } }
          : { type: 'file', attrs: { src: stored.url, name: stored.name, mime: stored.mime } };
        await services.pages.update(ctx, pageId, {
          snapshot: { ...snapshot, content: [...content, block] } as RichText,
        });
      }
      return {
        undo: { pageId, snapshot },
        result: { ...stored, markdown, appended: append, href: pageHref(pageId) },
      };
    },
    undo: async (ctx, { pageId, snapshot }) => {
      if (snapshot) await services.pages.update(ctx, pageId, { snapshot });
    },
  });
  return [upload] as AiToolDefinition[];
}
