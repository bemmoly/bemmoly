import { isApiError } from '@bemmoly/api-client';
import type { UploadedDocument, UploadedImage, UploadOptions } from '@bemmoly/editor';
import { DEFAULT_UPLOAD_MAX_BYTES } from '@bemmoly/shared';
import { api } from '../../shared/api.ts';

/** The page's file target in the kernel's files API: files belong to the page they are in. */
const PAGE_TARGET = 'docs.page';

const megabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

type Upload = 'image' | 'file';

/** What the editor shows when an upload fails: what happened, and what to do now. */
export function uploadErrorMessage(error: unknown, kind: Upload = 'image'): string {
  if (!isApiError(error)) return 'The upload did not finish. Try again.';
  const details = (error.details ?? {}) as { reason?: string; maxBytes?: number };
  if (error.code === 'payload_too_large' || details.reason === 'too_large') {
    return `That ${kind} is over ${megabytes(details.maxBytes ?? DEFAULT_UPLOAD_MAX_BYTES)}. Make it smaller and try again.`;
  }
  if (details.reason === 'svg_refused')
    return 'SVG images can’t be added. Export it as PNG and try again.';
  if (details.reason === 'unsupported_type') {
    return kind === 'image'
      ? 'Only PNG, JPEG, GIF and WebP images can be added.'
      : 'Only PDF and HTML files can be added here.';
  }
  if (error.code === 'rate_limited')
    return 'That’s a lot of uploads at once. Wait a minute and try again.';
  if (error.code === 'forbidden' || error.code === 'module_access_denied') {
    return `You can view this page but not add ${kind}s to it.`;
  }
  if (error.code === 'network_error')
    return 'Bemmoly could not reach the server. Check your connection and try again.';
  return 'The upload did not finish. Try again.';
}

/** Stores an image as a file of the page and returns the URL the page keeps. */
export async function uploadPageImage(
  pageId: string,
  file: File,
  options: UploadOptions = {},
): Promise<UploadedImage> {
  try {
    const stored = await api.files.upload(
      file,
      { target: PAGE_TARGET, targetId: pageId, ...(file.name ? { name: file.name } : {}) },
      options,
    );
    return { src: stored.url };
  } catch (error) {
    throw new Error(uploadErrorMessage(error), { cause: error });
  }
}

/** Stores a PDF or HTML file as a file of the page, for the File block. */
export async function uploadPageFile(
  pageId: string,
  file: File,
  options: UploadOptions = {},
): Promise<UploadedDocument> {
  let stored;
  try {
    stored = await api.files.upload(
      file,
      { target: PAGE_TARGET, targetId: pageId, ...(file.name ? { name: file.name } : {}) },
      options,
    );
  } catch (error) {
    throw new Error(uploadErrorMessage(error, 'file'), { cause: error });
  }
  // The server reads the bytes; a file that turned out to be an image is not a document.
  if (stored.mime !== 'application/pdf' && stored.mime !== 'text/html') {
    throw new Error('That is an image. Add it with the Image block instead.');
  }
  return { src: stored.url, name: stored.name, mime: stored.mime };
}
