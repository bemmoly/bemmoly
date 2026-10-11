import { isApiError } from '@bemmoly/api-client';
import type { UploadedImage, UploadOptions } from '@bemmoly/editor';
import { DEFAULT_UPLOAD_MAX_BYTES } from '@bemmoly/shared';
import { api } from '../../shared/api.ts';

/** The page's file target in the kernel's files API: images belong to the page they are in. */
const PAGE_TARGET = 'docs.page';

const megabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** What the editor shows when an upload fails: what happened, and what to do now. */
export function uploadErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'The upload did not finish. Try again.';
  const details = (error.details ?? {}) as { reason?: string; maxBytes?: number };
  if (error.code === 'payload_too_large' || details.reason === 'too_large') {
    return `That image is over ${megabytes(details.maxBytes ?? DEFAULT_UPLOAD_MAX_BYTES)}. Make it smaller and try again.`;
  }
  if (details.reason === 'svg_refused')
    return 'SVG images can’t be added. Export it as PNG and try again.';
  if (details.reason === 'unsupported_type')
    return 'Only PNG, JPEG, GIF and WebP images can be added.';
  if (error.code === 'rate_limited')
    return 'That’s a lot of uploads at once. Wait a minute and try again.';
  if (error.code === 'forbidden' || error.code === 'module_access_denied') {
    return 'You can view this page but not add images to it.';
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
