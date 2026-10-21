import { fileIdOf, fileUrl, type RequestContext } from '@bemmoly/core';
import { asFileBlocks, imageSources, type StoredDocument } from '@bemmoly/editor/convert';
import {
  NotFoundError,
  ValidationError,
  type UploadedFile,
  type UploadLink,
} from '@bemmoly/shared';
import type { RichText } from '../../../../shared/common.ts';
import { DOCS_PAGE_KIND } from '../collab/index.ts';
import type { DocsServiceDeps } from '../common.ts';

type Readable = Parameters<typeof imageSources>[0];

/**
 * Files an agent adds to pages: stored against the page like the editor's uploads, and found
 * again in Markdown, where image syntax is the only way to name one, so a stored PDF or HTML
 * file written into a body lands as a File block in its place.
 */
export function createAttachmentsService(deps: DocsServiceDeps) {
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
