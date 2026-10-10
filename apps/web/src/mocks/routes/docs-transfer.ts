import { can, emit, type MockDb } from '../db.ts';
import type { MockPage } from '../seed/docs.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, notFound, ok, type MockRoute } from '../types.ts';
import type { PmNode } from './docs-diff.ts';
import { snapshotOf, textOf } from './docs-history-state.ts';
import { childrenOf, docsState, live, nextPosition, spaceByRef } from './docs-state.ts';

/*
 * Export and import on the in-memory backend. Export answers a file (Markdown or a plain
 * HTML page) the browser downloads; the subtree comes as one Markdown file, not a zip.
 * Import turns Markdown files into pages at once, folders into parent pages.
 */

const BASE = '/api/v1/docs';
const now = () => new Date().toISOString();

function inline(nodes: PmNode[] = []): string {
  return nodes
    .map((node) => {
      if (node.type === 'issueEmbed') return String(node.attrs?.['key'] ?? '');
      if (node.type === 'hardBreak') return '  \n';
      let text = node.text ?? '';
      for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') text = `**${text}**`;
        if (mark.type === 'italic') text = `_${text}_`;
        if (mark.type === 'code') text = `\`${text}\``;
        if (mark.type === 'link') text = `[${text}](${String(mark.attrs?.['href'] ?? '')})`;
      }
      return text;
    })
    .join('');
}

/** A body as Markdown, close enough for the dev mock's download. */
export function toMarkdown(node: PmNode, depth = 0): string {
  return (node.content ?? [])
    .map((block): string => {
      switch (block.type) {
        case 'heading':
          return `${'#'.repeat(Number(block.attrs?.['level'] ?? 2))} ${inline(block.content)}`;
        case 'paragraph':
          return inline(block.content);
        case 'bulletList':
        case 'orderedList':
          return (block.content ?? [])
            .map(
              (item, index) =>
                `${'  '.repeat(depth)}${block.type === 'orderedList' ? `${index + 1}.` : '-'} ${toMarkdown(item, depth + 1).trim()}`,
            )
            .join('\n');
        case 'codeBlock':
          return `\`\`\`\n${textOf(block)}\n\`\`\``;
        default:
          return textOf(block);
      }
    })
    .join('\n\n');
}

const fileName = (title: string, extension: string) =>
  `${
    (title || 'Untitled')
      .replace(/[^\w -]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'page'
  }.${extension}`;

/** Markdown text as the stored body: headings and paragraphs, front matter dropped. */
function fromMarkdown(source: string): { title: string | null; body: PmNode } {
  const front = /^---\n([\s\S]*?)\n---\n?/.exec(source);
  const title = front ? (/^title:\s*(.+)$/m.exec(front[1]!)?.[1]?.trim() ?? null) : null;
  const blocks = source
    .slice(front?.[0].length ?? 0)
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): PmNode => {
      const heading = /^(#{1,3})\s+(.*)$/.exec(chunk);
      return heading
        ? {
            type: 'heading',
            attrs: { level: heading[1]!.length },
            content: [{ type: 'text', text: heading[2]! }],
          }
        : { type: 'paragraph', content: [{ type: 'text', text: chunk.replace(/\n/g, ' ') }] };
    });
  const first = blocks[0];
  const headingTitle = first?.type === 'heading' ? textOf(first) : null;
  return {
    title: title ?? headingTitle,
    body: { type: 'doc', content: headingTitle && !title ? blocks.slice(1) : blocks },
  };
}

function createPage(
  db: MockDb,
  spaceId: string,
  parent: MockPage | null,
  title: string,
  body: PmNode,
): MockPage {
  const state = docsState(db);
  const id = newId();
  const text = textOf(body);
  const row: MockPage = {
    id,
    spaceId,
    parentId: parent?.id ?? null,
    position: nextPosition(childrenOf(state, spaceId, parent?.id ?? null)),
    path: `${parent?.path ?? '/'}${id}/`,
    title,
    icon: null,
    status: 'draft',
    ownerId: db.signedInAs,
    reviewers: [],
    templateId: null,
    text,
    snapshot: body,
    labels: [],
    wordCount: text.split(/\s+/).filter(Boolean).length,
    version: 1,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  };
  state.pages.push(row);
  return row;
}

export const docsTransferRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${BASE}/pages/:pageId/export`,
    handle: (request, db) => {
      const state = docsState(db);
      const row = state.pages.find((item) => item.id === request.params['pageId'] && live(item));
      if (!row) return notFound('Page');
      const html = request.query.get('format') === 'html';
      const subtree = request.query.get('scope') === 'subtree';
      if (subtree && !can(db, 'docs.space.export'))
        return fail(403, 'forbidden', 'You may not export this space');
      const pages = subtree
        ? state.pages.filter((item) => live(item) && item.path.startsWith(row.path))
        : [row];
      const markdown = pages
        .map((item) => `# ${item.title || 'Untitled'}\n\n${toMarkdown(snapshotOf(item))}`)
        .join('\n\n---\n\n');
      const body = html
        ? `<!doctype html><meta charset="utf-8"><title>${row.title}</title><pre>${markdown.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</pre>`
        : `${markdown}\n`;
      return {
        status: 200,
        body,
        headers: {
          'content-type': html ? 'text/html; charset=utf-8' : 'text/markdown; charset=utf-8',
          'content-disposition': `attachment; filename="${fileName(row.title, html ? 'html' : 'md')}"`,
        },
      };
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/spaces/:spaceKey/imports`,
    handle: (request, db) => {
      if (!can(db, 'docs.page.edit'))
        return fail(403, 'forbidden', 'You do not have permission to do this');
      const state = docsState(db);
      const space = spaceByRef(state, request.params['spaceKey'] ?? '');
      if (!space) return notFound('Space');
      const input = bodyOf<{
        format: string;
        parentId: string;
        files: { path: string; content: string; title?: string }[];
      }>(request);
      const root = state.pages.find((row) => row.id === input.parentId) ?? null;
      const folders = new Map<string, MockPage>();
      const folderPage = (path: string): MockPage | null => {
        if (!path) return root;
        const found = folders.get(path);
        if (found) return found;
        const parent = folderPage(path.split('/').slice(0, -1).join('/'));
        const made = createPage(db, space.id, parent, path.split('/').at(-1)!, {
          type: 'doc',
          content: [],
        });
        folders.set(path, made);
        return made;
      };
      const pages = [...(input.files ?? [])]
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((file) => {
          const parts = file.path.split('/');
          const parsed =
            input.format === 'markdown'
              ? fromMarkdown(file.content)
              : {
                  title: null,
                  body: {
                    type: 'doc',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          { type: 'text', text: file.content.replace(/<[^>]+>/g, ' ').trim() },
                        ],
                      },
                    ],
                  },
                };
          const name = parts.at(-1)!.replace(/\.[^.]+$/, '');
          return createPage(
            db,
            space.id,
            folderPage(parts.slice(0, -1).join('/')),
            file.title ?? parsed.title ?? name,
            parsed.body,
          );
        });
      const made = [...folders.values(), ...pages];
      emit(
        db,
        'docs.tree',
        made.map((row) => row.id),
      );
      return ok(
        {
          status: 'completed',
          pages: made.map((row) => ({
            id: row.id,
            parentId: row.parentId,
            title: row.title,
            path: row.path,
            status: row.status,
            placeholders: 0,
          })),
        },
        201,
      );
    },
  },
];
