import { z } from 'zod';

/** Image types the files API stores, as sniffed from the bytes; SVG is refused (it can script). */
export const UPLOAD_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
export type UploadImageType = (typeof UPLOAD_IMAGE_TYPES)[number];

/**
 * Documents the files API stores besides images. HTML is served only inside a sandbox with an
 * origin of its own (ADR 0037), so its scripts never act as the person reading it.
 */
export const UPLOAD_DOCUMENT_TYPES = ['application/pdf', 'text/html'] as const;
export type UploadDocumentType = (typeof UPLOAD_DOCUMENT_TYPES)[number];

export const UPLOAD_FILE_TYPES = [...UPLOAD_IMAGE_TYPES, ...UPLOAD_DOCUMENT_TYPES] as const;
export type UploadFileType = (typeof UPLOAD_FILE_TYPES)[number];

export const isUploadImageType = (mime: string): mime is UploadImageType =>
  (UPLOAD_IMAGE_TYPES as readonly string[]).includes(mime);

/** The default largest upload, 10 MiB; BEMMOLY_UPLOAD_MAX_BYTES changes it. */
export const DEFAULT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/** POST /api/v1/files: the target the file belongs to and its name; the body is the bytes. */
export const uploadFileQuerySchema = z.object({
  target: z.string().regex(/^[a-z][a-z0-9-]*\.[a-z0-9.-]+$/),
  targetId: z.string().min(1).max(200),
  name: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((value) => value || undefined),
});
export type UploadFileQuery = z.output<typeof uploadFileQuerySchema>;

export const fileIdParamsSchema = z.object({ id: z.uuid() });

export const uploadedFileSchema = z.object({
  id: z.uuid(),
  /**
   * Where to read it: a same-origin path, which content stores instead of the bytes. The dev
   * mock answers with a blob: URL of the file it was given.
   */
  url: z.string().regex(/^(\/(?!\/)|blob:)/),
  name: z.string(),
  mime: z.enum(UPLOAD_FILE_TYPES),
  size: z.number().int().nonnegative(),
});
export type UploadedFile = z.output<typeof uploadedFileSchema>;
