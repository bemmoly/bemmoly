import { docNode } from '../schema/nodes/registry.ts';
import type { ExportContext } from '../schema/nodes/types.ts';
import type { RichTextDoc, RichTextNode } from '../types.ts';
import { exportStylesheet } from './html-style.ts';
import { escapeHtml, safeHref, SAFE_LINK, type ExportOptions } from './options.ts';
import { buildToc, headingIds } from './text.ts';

/*
 * ProseMirror JSON to HTML. Every byte of markup is written here from the schema's JSON,
 * never copied from input, so the output is sanitized by construction: text and attribute
 * values are escaped, links and images keep only web and in-app URLs, and no script, style
 * attribute or event handler can appear. `toHtmlDocument` wraps it in a self-contained file.
 */

const MARK_TAGS: Record<string, string> = {
  bold: 'strong',
  italic: 'em',
  strike: 's',
  code: 'code',
};

function markText(node: RichTextNode): string {
  let out = escapeHtml(node.text ?? '');
  const marks = node.marks ?? [];
  for (const mark of marks) {
    const tag = MARK_TAGS[mark.type];
    if (tag) out = `<${tag}>${out}</${tag}>`;
  }
  const link = marks.find((mark) => mark.type === 'link');
  const href = String(link?.attrs?.['href'] ?? '');
  if (link && SAFE_LINK.test(href)) {
    out = `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow">${out}</a>`;
  }
  return out;
}

/** The body markup of a document: what goes inside <article>. */
export function toHtml(doc: RichTextDoc | null | undefined, options: ExportOptions = {}): string {
  const ids = headingIds(doc);
  let heading = 0;
  const context: ExportContext = {
    blocks: (nodes) => (nodes ?? []).map((node) => block(node)).join(''),
    inline: (nodes) => (nodes ?? []).map(inline).join(''),
    escape: escapeHtml,
    pageHref: (id) => safeHref(options.pageHref?.(id)),
    issueHref: (key) => safeHref(options.issueHref?.(key)),
  };

  function inline(node: RichTextNode): string {
    if (node.type === 'text') return markText(node);
    if (node.type === 'hardBreak') return '<br>';
    const registered = docNode(node.type)?.toHtml;
    if (registered) return registered(node, context);
    return context.inline(node.content);
  }

  function block(node: RichTextNode, topLevel = false): string {
    const inner = () => context.blocks(node.content);
    switch (node.type) {
      case 'paragraph':
        return `<p>${context.inline(node.content)}</p>`;
      case 'heading': {
        const level = Math.min(6, Math.max(1, Number(node.attrs?.['level'] ?? 1)));
        const id = topLevel ? ` id="${escapeHtml(ids[heading++] ?? '')}"` : '';
        return `<h${level}${id}>${context.inline(node.content)}</h${level}>`;
      }
      case 'bulletList':
        return `<ul>${inner()}</ul>`;
      case 'orderedList': {
        const start = Number(node.attrs?.['start'] ?? 1);
        return `<ol${start !== 1 ? ` start="${start}"` : ''}>${inner()}</ol>`;
      }
      case 'listItem':
        return `<li>${inner()}</li>`;
      case 'taskList':
        return `<ul class="tasks">${inner()}</ul>`;
      case 'taskItem': {
        const checked = node.attrs?.['checked'] ? ' checked' : '';
        return `<li><input type="checkbox" disabled${checked}> ${inner()}</li>`;
      }
      case 'blockquote':
        return `<blockquote>${inner()}</blockquote>`;
      case 'horizontalRule':
        return '<hr>';
      case 'toc': {
        const entries = buildToc(doc, Number(node.attrs?.['maxLevel'] ?? 3));
        const rows = entries
          .map(
            (entry) =>
              `<li class="toc-${entry.level}"><a href="#${escapeHtml(entry.id)}">${escapeHtml(entry.text)}</a></li>`,
          )
          .join('');
        return rows ? `<nav class="toc"><ul>${rows}</ul></nav>` : '';
      }
      default: {
        const registered = docNode(node.type)?.toHtml;
        if (registered) return registered(node, context);
        return node.content?.some((child) => child.type === 'text')
          ? `<p>${context.inline(node.content)}</p>`
          : inner();
      }
    }
  }

  return (doc?.content ?? []).map((node) => block(node, true)).join('');
}

/** A whole HTML file: the title as the page heading, the body, and the stylesheet inline. */
export function toHtmlDocument(
  doc: RichTextDoc | null | undefined,
  title: string,
  options: ExportOptions = {},
): string {
  const safeTitle = escapeHtml(title);
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${safeTitle}</title>`,
    `<style>${exportStylesheet()}</style>`,
    '</head>',
    `<body><article><h1>${safeTitle}</h1>${toHtml(doc, options)}</article></body>`,
    '</html>',
    '',
  ].join('\n');
}
