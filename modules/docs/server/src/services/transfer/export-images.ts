import { fileIdOf, type FilesRegistry, type RequestContext } from '@bemmoly/core';

/*
 * Uploaded images in an export. A file stored by the kernel is readable only inside the app,
 * so an export that leaves it carries the image itself: a self-contained HTML page embeds it
 * as a data: URI, and a folder export holds it under images/ beside the pages that show it.
 * A single Markdown file keeps the in-app path, as it does for links to other pages. An
 * image the person may not read, or that is gone, keeps its path too.
 */

const FILE_URL = /\/api\/v1\/files\/[0-9a-f-]{36}/gi;

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export interface ExportImage {
  mime: string;
  data: Buffer;
  /** Its path inside a folder export. */
  path: string;
}

async function readAll(body: AsyncIterable<Buffer | string>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** Every uploaded image the pages show that the person may read, by its in-app path. */
export async function collectImages(
  files: Pick<FilesRegistry, 'read'> | undefined,
  ctx: RequestContext,
  snapshots: readonly unknown[],
): Promise<Map<string, ExportImage>> {
  const images = new Map<string, ExportImage>();
  if (!files) return images;
  const sources = new Set(
    snapshots.flatMap((doc) => JSON.stringify(doc ?? null).match(FILE_URL) ?? []),
  );
  for (const src of sources) {
    const id = fileIdOf(src);
    if (!id) continue;
    try {
      const file = await files.read(ctx, id);
      const extension = EXTENSIONS[file.mime];
      if (!extension) continue;
      images.set(src, {
        mime: file.mime,
        data: await readAll(file.body),
        path: `images/${id}.${extension}`,
      });
    } catch {
      // Not readable for this person, or gone: the export keeps the in-app path.
    }
  }
  return images;
}

export const dataUri = (image: ExportImage) =>
  `data:${image.mime};base64,${image.data.toString('base64')}`;
