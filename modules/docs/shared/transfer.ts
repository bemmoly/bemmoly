import { z } from 'zod';
import { pageStatusSchema } from './common.ts';

/*
 * Exports and imports.
 *   GET  /api/v1/docs/pages/:pageId/export?format=markdown|html&scope=page|subtree
 *        One page as a .md or a self-contained .html file (styles inline), or the page and
 *        everything under it as a .zip of either, with links between them made relative.
 *   POST /api/v1/docs/spaces/:spaceKey/imports
 *        Markdown files (a folder's tree becomes the page tree; front matter "title" names a
 *        page) or Confluence storage-format XHTML, under an optional parent page. Unknown
 *        Confluence macros become labelled placeholder blocks. A small import runs at once
 *        (201 with the pages); a big one is queued as the docs.import job (202) under the
 *        request's Idempotency-Key, and the tree updates over realtime when it lands.
 */

export const EXPORT_FORMATS = ['markdown', 'html'] as const;
export const EXPORT_SCOPES = ['page', 'subtree'] as const;

export const exportQuerySchema = z.object({
  format: z.enum(EXPORT_FORMATS).default('markdown'),
  scope: z.enum(EXPORT_SCOPES).default('page'),
});

export const IMPORT_FORMATS = ['markdown', 'confluence'] as const;

/** Every byte an import may carry, and the most it runs at once rather than as a job. */
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const IMPORT_INLINE_MAX_FILES = 25;
export const IMPORT_INLINE_MAX_BYTES = 512 * 1024;

export const importFileSchema = z.object({
  /** Path inside the import, "/" separated: folders become parent pages. */
  path: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((path) => !path.split('/').includes('..'), 'Paths stay inside the import'),
  content: z.string().max(IMPORT_MAX_BYTES),
  /** A Confluence export names its pages; Markdown reads the title from the file. */
  title: z.string().trim().min(1).max(500).optional(),
});

export const importBodySchema = z
  .object({
    format: z.enum(IMPORT_FORMATS),
    parentId: z.uuid().optional(),
    files: z.array(importFileSchema).min(1).max(2000),
  })
  .refine(
    (body) => body.files.reduce((sum, file) => sum + file.content.length, 0) <= IMPORT_MAX_BYTES,
    { message: 'An import carries at most 10 MB of text' },
  );

export const importedPageSchema = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  title: z.string(),
  path: z.string(),
  status: pageStatusSchema,
  /** Confluence macros that had no node and became placeholder blocks. */
  placeholders: z.number().int().nonnegative(),
});

export const importResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('completed'), pages: z.array(importedPageSchema) }),
  z.object({
    status: z.literal('queued'),
    jobId: z.string().nullable(),
    idempotencyKey: z.string(),
  }),
]);

export type ExportQuery = z.infer<typeof exportQuerySchema>;
export type ImportFile = z.infer<typeof importFileSchema>;
export type ImportBody = z.infer<typeof importBodySchema>;
export type ImportedPage = z.infer<typeof importedPageSchema>;
export type ImportResult = z.infer<typeof importResultSchema>;
