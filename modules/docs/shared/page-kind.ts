import type { RichText } from './common.ts';
import type { PageKind } from './pages.ts';

interface Block {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: unknown[];
}

/** The one file a file page shows: where it is served, its name and the type the server read. */
export interface PageFile {
  src: string;
  name: string;
  mime: 'text/html' | 'application/pdf';
}

const blocksOf = (body: RichText | null | undefined): Block[] =>
  ((body as { content?: unknown } | null | undefined)?.content as Block[] | undefined) ?? [];

/** The editor keeps a paragraph at each end of a document; one with nothing in it holds nothing. */
const isBlankParagraph = (block: Block) =>
  block.type === 'paragraph' && (block.content?.length ?? 0) === 0;

const asPageFile = (block: Block): PageFile | null => {
  const mime = block.attrs?.['mime'];
  if (block.type !== 'file' || (mime !== 'text/html' && mime !== 'application/pdf')) return null;
  return {
    src: String(block.attrs?.['src'] ?? ''),
    name: String(block.attrs?.['name'] ?? ''),
    mime,
  };
};

/**
 * The file a body is made of: exactly one PDF or HTML File block, beside blank paragraphs only.
 * Null for any other body, so a page with a line written under its file is not a file page.
 */
export function pageFileOf(body: RichText | null | undefined): PageFile | null {
  const blocks = blocksOf(body).filter((block) => !isBlankParagraph(block));
  return blocks.length === 1 && blocks[0] ? asPageFile(blocks[0]) : null;
}

/** True for a body with nothing in it: none at all, or blank paragraphs only. */
export const isEmptyBody = (body: RichText | null | undefined) =>
  blocksOf(body).every(isBlankParagraph);

/** The body a file page holds: its file and nothing else. */
export const fileBody = (file: PageFile): RichText => ({
  type: 'doc',
  content: [{ type: 'file', attrs: { src: file.src, name: file.name, mime: file.mime } }],
});

/**
 * Whether a page with this body may become `to` (ADR 0049): a page always; a folder only with
 * nothing written, so no writing is hidden; a file page only when the body is one file.
 */
export function kindAllowed(to: PageKind, body: RichText | null | undefined): boolean {
  if (to === 'folder') return isEmptyBody(body);
  if (to === 'file') return pageFileOf(body) !== null;
  return true;
}
