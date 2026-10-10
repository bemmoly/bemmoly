import { docNode } from '../schema/nodes/registry.ts';
import type { ExportContext } from '../schema/nodes/types.ts';
import type { RichTextDoc, RichTextNode } from '../types.ts';
import {
  escapeLineStart,
  escapeMarkdown,
  safeHref,
  SAFE_LINK,
  type ExportOptions,
} from './options.ts';
import { buildToc } from './text.ts';

/*
 * ProseMirror JSON to CommonMark with GitHub's tables, task lists and strikethrough. Base
 * nodes are printed here; each registered node prints itself (callouts as GitHub's alert
 * quotes, issue tables as an `lql` fence) so the Markdown importer can read them back.
 */

const MARKS: Record<string, [string, string]> = {
  bold: ['**', '**'],
  italic: ['_', '_'],
  strike: ['~~', '~~'],
};

function markText(node: RichTextNode): string {
  const marks = node.marks ?? [];
  const code = marks.some((mark) => mark.type === 'code');
  let out = code ? codeSpan(node.text ?? '') : escapeMarkdown(node.text ?? '');
  for (const mark of marks) {
    const wrap = MARKS[mark.type];
    if (wrap) out = `${wrap[0]}${out}${wrap[1]}`;
  }
  const link = marks.find((mark) => mark.type === 'link');
  const href = String(link?.attrs?.['href'] ?? '');
  if (link && SAFE_LINK.test(href)) out = `[${out}](${href.replace(/[()\s]/g, encodeURI)})`;
  return out;
}

function codeSpan(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

/** Prefixes the first line with a marker and indents the rest to line up under it. */
function hang(marker: string, body: string): string {
  const indent = ' '.repeat(marker.length);
  return body
    .split('\n')
    .map((line, i) => (i === 0 ? `${marker}${line}` : line ? `${indent}${line}` : ''))
    .join('\n');
}

export function toMarkdown(doc: RichTextDoc | null | undefined, options: ExportOptions = {}) {
  const context: ExportContext = {
    blocks: (nodes) =>
      (nodes ?? [])
        .map(block)
        .filter((out) => out !== '')
        .join('\n\n'),
    inline: (nodes) => (nodes ?? []).map(inline).join(''),
    escape: (text) => text,
    pageHref: (id) => safeHref(options.pageHref?.(id)),
    issueHref: (key) => safeHref(options.issueHref?.(key)),
  };

  function inline(node: RichTextNode): string {
    if (node.type === 'text') return markText(node);
    if (node.type === 'hardBreak') return '\\\n';
    const registered = docNode(node.type)?.toMarkdown;
    if (registered) return registered(node, context);
    return context.inline(node.content);
  }

  function items(node: RichTextNode, marker: (index: number) => string): string {
    return (node.content ?? [])
      .map((item, index) => hang(marker(index), context.blocks(item.content) || ''))
      .join('\n');
  }

  function block(node: RichTextNode): string {
    switch (node.type) {
      case 'paragraph':
        return escapeLineStart(context.inline(node.content));
      case 'heading': {
        const level = Math.min(6, Math.max(1, Number(node.attrs?.['level'] ?? 1)));
        return `${'#'.repeat(level)} ${context.inline(node.content)}`;
      }
      case 'bulletList':
        return items(node, () => '- ');
      case 'orderedList': {
        const start = Number(node.attrs?.['start'] ?? 1);
        return items(node, (index) => `${start + index}. `);
      }
      case 'taskList':
        return (node.content ?? [])
          .map((item) => {
            const box = item.attrs?.['checked'] ? '[x]' : '[ ]';
            return hang(`- ${box} `, context.blocks(item.content));
          })
          .join('\n');
      case 'blockquote':
        return context
          .blocks(node.content)
          .split('\n')
          .map((line) => (line ? `> ${line}` : '>'))
          .join('\n');
      case 'horizontalRule':
        return '---';
      case 'toc': {
        const entries = buildToc(doc, Number(node.attrs?.['maxLevel'] ?? 3));
        const top = Math.min(...entries.map((entry) => entry.level));
        return entries
          .map((entry) => {
            const indent = '  '.repeat(entry.level - top);
            return `${indent}- [${escapeMarkdown(entry.text)}](#${entry.id})`;
          })
          .join('\n');
      }
      default: {
        const registered = docNode(node.type)?.toMarkdown;
        if (registered) return registered(node, context);
        return context.blocks(node.content);
      }
    }
  }

  const out = context.blocks(doc?.content);
  return out ? `${out}\n` : '';
}
