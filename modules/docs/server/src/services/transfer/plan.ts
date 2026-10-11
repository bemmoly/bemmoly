import { ValidationError } from '@bemmoly/shared';
import type { ImportFile } from '../../../../shared/transfer.ts';

/*
 * An import's files as a page tree, before anything is written: one node per file, plus one
 * per folder that has no index file of its own. A folder's index.md (or README.md) becomes
 * the folder's page. Parents always come before their children.
 */

export interface PlannedPage {
  /** The node's path inside the import, folders included: "guides/deploy.md". */
  key: string;
  parentKey: string | null;
  title: string;
  /** The page body as imported text, or null for a folder with no index file. */
  content: string | null;
}

const MARKDOWN = /\.(md|markdown)$/i;
const XHTML = /\.(x?html?|xml)$/i;
const INDEX = /^(index|readme)\.(md|markdown)$/i;
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** "deploy-the_api.md" reads as "Deploy the api". */
export function titleFromName(name: string): string {
  const bare = name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return bare ? bare.charAt(0).toUpperCase() + bare.slice(1) : 'Untitled';
}

/** The title and body of a Markdown file: front matter, then a leading H1, then the name. */
export function readMarkdown(content: string, fileName: string): { title: string; body: string } {
  let body = content;
  let title: string | null = null;
  const front = FRONT_MATTER.exec(body);
  if (front) {
    body = body.slice(front[0].length);
    const named = /^title:\s*(.+)$/m.exec(front[1] ?? '');
    if (named?.[1]) title = named[1].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  const heading = /^\s*#\s+(.+?)\s*#*\s*(\r?\n|$)/.exec(body);
  if (heading && title === null) {
    title = heading[1]!.trim();
    body = body.slice(heading[0].length);
  }
  return { title: title ?? titleFromName(fileName), body };
}

const clean = (path: string) =>
  path
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.')
    .join('/');

export function planImport(format: 'markdown' | 'confluence', files: readonly ImportFile[]) {
  const pages = new Map<string, PlannedPage>();
  const ensureFolder = (folder: string): string | null => {
    if (!folder) return null;
    const existing = pages.get(folder);
    if (existing) return existing.key;
    const segments = folder.split('/');
    const parentKey = ensureFolder(segments.slice(0, -1).join('/'));
    pages.set(folder, {
      key: folder,
      parentKey,
      title: titleFromName(segments.at(-1)!),
      content: null,
    });
    return folder;
  };
  for (const file of files) {
    const path = clean(file.path);
    const segments = path.split('/');
    const name = segments.at(-1) ?? '';
    const folder = segments.slice(0, -1).join('/');
    const wanted = format === 'markdown' ? MARKDOWN : XHTML;
    if (!wanted.test(name)) {
      throw new ValidationError(
        `${path} is not a ${format === 'markdown' ? 'Markdown' : 'Confluence'} file`,
      );
    }
    if (format === 'markdown' && INDEX.test(name) && folder) {
      const page = pages.get(ensureFolder(folder)!)!;
      const read = readMarkdown(file.content, segments.at(-2)!);
      pages.set(folder, { ...page, title: file.title ?? read.title, content: read.body });
      continue;
    }
    if (pages.has(path)) throw new ValidationError(`${path} appears twice in the import`);
    const parentKey = ensureFolder(folder);
    const read =
      format === 'markdown'
        ? readMarkdown(file.content, name)
        : { title: titleFromName(name), body: file.content };
    pages.set(path, { key: path, parentKey, title: file.title ?? read.title, content: read.body });
  }
  return [...pages.values()];
}
