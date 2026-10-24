import type { PageDetail } from '@bemmoly/module-docs/shared';
import { api } from '../shared/api.ts';
import { uploadErrorMessage } from '../page/body/upload-image.ts';

/** What the picker offers; the server still decides from the bytes. */
export const PAGE_FILE_ACCEPT = '.html,.htm,.pdf,text/html,application/pdf';

const titleOf = (name: string) => name.replace(/\.[^.]+$/, '').trim();

const asMessage = (error: unknown) =>
  error instanceof Error && !('code' in error)
    ? error
    : new Error(uploadErrorMessage(error, 'file'), { cause: error });

/**
 * Stores a PDF or HTML file against a file page and makes it the page's body, in place of
 * the file it showed (ADR 0049). Anything else the server stores is refused here.
 */
export async function putPageFile(pageId: string, file: File): Promise<PageDetail> {
  const stored = await api.files.upload(file, {
    target: 'docs.page',
    targetId: pageId,
    ...(file.name ? { name: file.name } : {}),
  });
  if (stored.mime !== 'text/html' && stored.mime !== 'application/pdf') {
    throw new Error('Only PDF and HTML files can be a page of their own.');
  }
  return api.docs.pages.attachFile(pageId, { fileId: stored.id });
}

/** Replace file on a file page: the new file shows where the old one did. */
export async function replacePageFile(pageId: string, file: File): Promise<PageDetail> {
  try {
    return await putPageFile(pageId, file);
  } catch (error) {
    throw asMessage(error);
  }
}

/**
 * A file page: made where the dialog says, the file stored against it and added as its body.
 * A file the server refuses takes the new page back out, so a failed upload never leaves an
 * empty page behind.
 */
export async function createFilePage(
  where: { spaceId: string; parentId: string | null; title: string },
  file: File,
): Promise<PageDetail> {
  const page = await api.docs.pages.create({
    ...where,
    kind: 'file',
    title: where.title || titleOf(file.name),
  });
  try {
    return await putPageFile(page.id, file);
  } catch (error) {
    await api.docs.pages.remove(page.id);
    throw asMessage(error);
  }
}
