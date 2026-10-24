import { fileIdOf, fileUrl, type RequestContext } from '@bemmoly/core';
import { asFileBlocks, imageSources, type StoredDocument } from '@bemmoly/editor/convert';
import {
  isUploadImageType,
  NotFoundError,
  ValidationError,
  type UploadedFile,
  type UploadLink,
} from '@bemmoly/shared';
import type { RichText } from '../../../../shared/common.ts';
import { fileBody } from '../../../../shared/page-kind.ts';
import { DOCS_PAGE_KIND } from '../collab/index.ts';
import type { DocsServiceDeps } from '../common.ts';
import type { PagesService } from '../pages/index.ts';

type Readable = Parameters<typeof imageSources>[0];

const EMPTY_DOCUMENT: RichText = { type: 'doc', content: [{ type: 'paragraph' }] };

/** A stored file as the block that shows it: an image, or a File block for a document. */
function blockOf(file: { url: string; name: string; mime: string }) {
  return isUploadImageType(file.mime)
    ? { type: 'image', attrs: { src: file.url, alt: file.name } }
    : { type: 'file', attrs: { src: file.url, name: file.name, mime: file.mime } };
}

/**
 * Files added to pages from outside the editor: by an agent, or as a page of its own (New
 * page, Upload). They are stored against the page like the editor's uploads, added at the
 * end of its body, and found again in Markdown, where image syntax is the only way to name
 * one, so a stored PDF or HTML file written into a body lands as a File block in its place.
 */
export function createAttachmentsService(deps: DocsServiceDeps, pages: PagesService) {
  const upload = deps.files?.upload;
  const stat = deps.files?.stat;
  const createUploadLink = deps.files?.createUploadLink;

  return {
    async upload(
      ctx: RequestContext,
      pageId: string,
      name: string,
      body: Buffer,
    ): Promise<UploadedFile> {
      if (!upload) throw new ValidationError('Files cannot be added on this install');
      return upload(ctx, { target: DOCS_PAGE_KIND, targetId: pageId, name }, body);
    },

    /** A single-use link the agent sends a file too large for a tool call to (ADR 0048). */
    async createUploadLink(ctx: RequestContext, pageId: string, name: string): Promise<UploadLink> {
      if (!createUploadLink) throw new ValidationError('Files cannot be added on this install');
      return createUploadLink(ctx, { target: DOCS_PAGE_KIND, targetId: pageId, name });
    },

    /** A file already stored on this page (sent to an upload link), as the person sees it. */
    async onPage(ctx: RequestContext, pageId: string, fileId: string): Promise<UploadedFile> {
      if (!stat) throw new ValidationError('Files cannot be added on this install');
      const file = await stat(ctx, fileId);
      if (file.target.kind !== DOCS_PAGE_KIND || file.target.id !== pageId) {
        throw new ValidationError('That file belongs to another page; upload it to this one');
      }
      const { name, mime, size } = file;
      return { id: fileId, url: fileUrl(fileId), name, mime, size } as UploadedFile;
    },

    /**
     * Adds a stored file at the end of the page's body, through the same edit path as any
     * other change; on a file page the PDF or HTML file takes the place of the one it shows
     * (ADR 0049). Returns the body as it was before, for an undo.
     */
    async append(
      ctx: RequestContext,
      pageId: string,
      file: { url: string; name: string; mime: string },
    ): Promise<{ before: RichText }> {
      const page = await pages.get(ctx, pageId);
      const before = page.snapshot ?? EMPTY_DOCUMENT;
      if (page.kind === 'folder') {
        throw new ValidationError('A folder has no body; add the file to a page inside it');
      }
      if (page.kind === 'file') {
        if (file.mime !== 'text/html' && file.mime !== 'application/pdf') {
          throw new ValidationError(
            'A file page shows one PDF or HTML file; turn it into a page first',
          );
        }
        await pages.update(ctx, pageId, {
          snapshot: fileBody({ src: file.url, name: file.name, mime: file.mime }),
        });
        return { before };
      }
      const content = (before as { content?: unknown[] }).content ?? [];
      await pages.update(ctx, pageId, {
        snapshot: { ...before, content: [...content, blockOf(file)] } as RichText,
      });
      return { before };
    },

    /** Adds a file already stored on the page (a browser upload) at the end of its body. */
    async attach(ctx: RequestContext, pageId: string, fileId: string) {
      await this.append(ctx, pageId, await this.onPage(ctx, pageId, fileId));
      return pages.get(ctx, pageId);
    },

    /** The document with every image that is a stored PDF or HTML file made a File block. */
    async withFileBlocks(ctx: RequestContext, doc: RichText): Promise<RichText> {
      if (!stat) return doc;
      const documents = new Map<string, StoredDocument>();
      for (const src of imageSources(doc as Readable)) {
        const id = fileIdOf(src);
        if (!id) continue;
        try {
          documents.set(src, await stat(ctx, id));
        } catch (error) {
          // A file the person cannot read, or that is gone, stays the image it was written as.
          if (!(error instanceof NotFoundError)) throw error;
        }
      }
      return asFileBlocks(doc as Readable, documents) as RichText;
    },
  };
}

export type AttachmentsService = ReturnType<typeof createAttachmentsService>;
