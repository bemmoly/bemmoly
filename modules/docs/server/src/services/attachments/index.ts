import { fileIdOf, type RequestContext } from '@bemmoly/core';
import { asFileBlocks, imageSources, type StoredDocument } from '@bemmoly/editor/convert';
import { NotFoundError, ValidationError, type UploadedFile } from '@bemmoly/shared';
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
