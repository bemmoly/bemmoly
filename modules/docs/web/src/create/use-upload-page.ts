import type { PageDetail } from '@bemmoly/module-docs/shared';
import { api } from '../shared/api.ts';
import { uploadErrorMessage } from '../page/body/upload-image.ts';

/** What the picker offers; the server still decides from the bytes. */
export const PAGE_FILE_ACCEPT = '.html,.htm,.pdf,text/html,application/pdf';

const titleOf = (name: string) => name.replace(/\.[^.]+$/, '').trim();

/**
 * A page that is one file: made where the dialog says, the file stored against it and added
 * as its body. A file the server refuses takes the new page back out, so a failed upload
 * never leaves an empty page behind.
 */
export async function createFilePage(
  where: { spaceId: string; parentId: string | null; title: string },
  file: File,
): Promise<PageDetail> {
  const page = await api.docs.pages.create({
    ...where,
    title: where.title || titleOf(file.name),
  });
  try {
    const stored = await api.files.upload(file, {
      target: 'docs.page',
      targetId: page.id,
      ...(file.name ? { name: file.name } : {}),
    });
    if (stored.mime !== 'text/html' && stored.mime !== 'application/pdf') {
      throw new Error('Only PDF and HTML files can be a page of their own.');
    }
    return await api.docs.pages.attachFile(page.id, { fileId: stored.id });
  } catch (error) {
    await api.docs.pages.remove(page.id);
    throw error instanceof Error && !('code' in error)
      ? error
      : new Error(uploadErrorMessage(error, 'file'), { cause: error });
  }
}
