import type { RichTextDoc, RichTextNode } from './types.ts';

/*
 * Some descriptions and comments arrive as Markdown typed into plain text: an API or AI client
 * sent "## Change" and "| a | b |" and every line became a paragraph of its own. This spots
 * them without loading a parser, so the reader sees headings and tables, not the marks.
 */

const BLOCK_LINE = /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s?|```|~~~|\|.*\||-{3,}\s*$|\*{3,}\s*$)/;
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/;

const isPlain = (node: RichTextNode) =>
  node.type === 'text' && !node.marks?.length && typeof node.text === 'string';

/**
 * The Markdown source of a document made only of unformatted paragraphs whose lines read as
 * Markdown; null for any other document, which already carries its own structure.
 */
export function plainMarkdown(doc: RichTextDoc | null | undefined): string | null {
  const paragraphs = doc?.content ?? [];
  if (!paragraphs.length) return null;
  const lines: string[] = [];
  for (const node of paragraphs) {
    if (node.type !== 'paragraph') return null;
    const children = node.content ?? [];
    if (!children.every(isPlain)) return null;
    lines.push(children.map((child) => child.text).join(''));
  }
  return looksLikeMarkdown(lines) ? joinLines(lines) : null;
}

/** True when some line opens a Markdown block or carries bold, code or a link. */
export function looksLikeMarkdown(lines: readonly string[]): boolean {
  return lines.some((line) => BLOCK_LINE.test(line.trimStart()) || INLINE.test(line));
}

const TABLE = /^\s*\|/;
const ITEM = /^\s*([-*+]|\d+[.)])\s/;

/**
 * The paragraphs back as Markdown. Each stood alone, so they part with a blank line, except
 * where Markdown needs neighbours together: the rows of one table, the items of one list and
 * the lines of a fenced code block.
 */
export function joinLines(lines: readonly string[]): string {
  let fenced = false;
  let out = '';
  lines.forEach((line, index) => {
    const previous = lines[index - 1];
    if (index > 0) {
      const together =
        fenced ||
        (previous !== undefined &&
          ((TABLE.test(previous) && TABLE.test(line)) || (ITEM.test(previous) && ITEM.test(line))));
      out += together ? '\n' : '\n\n';
    }
    out += line;
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
  });
  return out;
}
