import { defineWriteTool, type AiToolDefinition, type RequestContext } from '@bemmoly/core';
import { z } from 'zod';
import { pageIdParamsSchema, type RichText } from '../../../../shared/common.ts';
import type { DocsServices } from '../index.ts';
import { pageHref } from './common.ts';

/*
 * An agent's file in a page: an HTML report it wrote, a PDF, an image. The bytes go through
 * the kernel's files API as the person, so the same sniffing, limits and sandbox apply as to
 * the editor's uploads. The MCP request body (1 MiB) caps what fits inline in one call; a
 * larger file goes to a single-use upload link (ADR 0048) and is then placed by its id.
 */

const CONTENT_MAX = 1_000_000;

const fileName = z.string().trim().min(1).max(255);

const uploadInput = pageIdParamsSchema
  .extend({
    name: fileName.optional(),
    content: z.string().min(1).max(CONTENT_MAX).optional(),
    encoding: z.enum(['utf8', 'base64']).default('utf8'),
    fileId: z.uuid().optional(),
    append: z.boolean().default(true),
  })
  .refine((input) => (input.content === undefined) !== (input.fileId === undefined), {
    message: 'Give content (with name), or fileId for a file sent to an upload link',
  })
  .refine((input) => input.content === undefined || input.name !== undefined, {
    message: 'Give the file a name',
    path: ['name'],
  });

type UploadInput = z.infer<typeof uploadInput>;

const linkInput = pageIdParamsSchema.extend({ name: fileName });

type LinkInput = z.infer<typeof linkInput>;

interface UploadUndo {
  pageId: string;
  /** The body before the file was added at its end; null when it was not added. */
  snapshot: RichText | null;
}

/** Whoever may add a file to the page: the page's editors. */
async function authorizeEdit(services: DocsServices, ctx: RequestContext, pageId: string) {
  const page = await services.pages.get(ctx, pageId);
  await ctx.authz.authorize(ctx.actor, 'docs.page.edit', {
    kind: 'space',
    id: page.spaceId,
    moduleId: 'docs',
  });
}

async function describeFile(
  services: DocsServices,
  ctx: RequestContext,
  pageId: string,
  name: string,
) {
  const page = await services.pages.get(ctx, pageId);
  return {
    target: page.spaceKey,
    change: page.title || 'Untitled',
    field: 'File',
    from: null,
    to: name,
    href: pageHref(page.id),
  };
}

function storedFile(services: DocsServices, ctx: RequestContext, input: UploadInput) {
  const { pageId, name, content, encoding, fileId } = input;
  if (fileId) return services.attachments.onPage(ctx, pageId, fileId);
  return services.attachments.upload(ctx, pageId, name ?? '', Buffer.from(content!, encoding));
}

export function fileTools(services: DocsServices): AiToolDefinition[] {
  const upload = defineWriteTool<UploadInput, UploadUndo>({
    name: 'docs_upload_file',
    kind: 'write',
    description:
      'Add a file to a page: an HTML page (send it as text), or a PDF or image (base64, ' +
      'encoding: "base64"), with its name. Inline content must stay under about 700 KB; ' +
      'for a larger file, send it to docs_create_upload_link, then call this with the ' +
      'fileId it answered with instead of content. People see it as a preview they can ' +
      'expand to full screen; HTML runs sandboxed and may load scripts, styles and fonts ' +
      'over https but cannot fetch. With append (the default) it goes at the end of the ' +
      'page; with append: false, place the returned markdown (![name](url)) where it ' +
      'belongs with docs_update_page. For a page that is only the file, create it with ' +
      'docs_create_page and no body first. Returns id, url, name, mime and markdown.',
    input: uploadInput,
    idempotent: false,
    describe: (ctx, { pageId, name, fileId }) =>
      describeFile(services, ctx, pageId, name ?? fileId ?? ''),
    authorize: (ctx, { pageId }) => authorizeEdit(services, ctx, pageId),
    run: async (ctx, input) => {
      const { pageId, append } = input;
      const stored = await storedFile(services, ctx, input);
      const markdown = `![${stored.name.replace(/[[\]]/g, '')}](${stored.url})`;
      const snapshot = append
        ? (await services.attachments.append(ctx, pageId, stored)).before
        : null;
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

/**
 * For MCP clients only: the in-app planner has no shell to send bytes with. The link takes
 * one file for this page as the person, for 15 minutes; placing it is docs_upload_file's.
 */
export function uploadLinkTool(services: DocsServices): AiToolDefinition {
  const link = defineWriteTool<LinkInput>({
    name: 'docs_create_upload_link',
    kind: 'write',
    description:
      'For a file too large to send inline to docs_upload_file (over about 700 KB, such as ' +
      'most PDFs): a single-use upload URL for one file in a page, valid for 15 minutes. ' +
      'Send the file to it with HTTP PUT and the raw bytes as the body, for example ' +
      "curl --fail-with-body -T report.pdf '<url>'. It answers with the stored file's id; " +
      'then call docs_upload_file with pageId and that fileId to add it to the page. ' +
      'Returns url, method, expiresAt, maxBytes and command.',
    input: linkInput,
    idempotent: false,
    describe: (ctx, { pageId, name }) => describeFile(services, ctx, pageId, name),
    authorize: (ctx, { pageId }) => authorizeEdit(services, ctx, pageId),
    run: async (ctx, { pageId, name }) => {
      const created = await services.attachments.createUploadLink(ctx, pageId, name);
      const file = name.replace(/'/g, '');
      return {
        result: {
          ...created,
          command: `curl --fail-with-body -T '${file}' '${created.url}'`,
          next: `docs_upload_file with pageId "${pageId}" and the fileId the upload answers with`,
        },
      };
    },
  });
  return link as AiToolDefinition;
}
