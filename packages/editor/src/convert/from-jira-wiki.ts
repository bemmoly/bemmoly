import type { RichTextDoc, RichTextNode } from '../types.ts';
import * as b from './build.ts';
import { finish } from './finish.ts';
import { SAFE_LINK } from './options.ts';

/*
 * Jira wiki markup (what Jira Data Center's REST v2 returns for descriptions and comments) to
 * ProseMirror JSON. The common subset maps: headings, bullet and numbered lists, code and
 * noformat blocks, quotes, bold, italic, strike, monospace and links; mentions resolve through
 * the importer. Anything else stays as its text, so nothing is lost.
 */

export interface JiraWikiOptions {
  /** "[~username]" or "[~accountid:…]" as a Bemmoly person. */
  resolveUser?: (name: string) => { id: string; label: string } | null;
}

const HEADING = /^h([1-6])\.\s+(.*)$/;
const LIST = /^([*#-]+)\s+(.*)$/;
const BLOCK_START = /^\{(code|noformat)(?::[^}]*)?\}(.*)$/;
const QUOTE = /^bq\.\s+(.*)$/;
const TOKEN =
  /\{\{(.+?)\}\}|\[~([^\]]+)\]|\[([^|\]]+)\|([^\]]+)\]|\[(https?:\/\/[^\]]+)\]|(?<![\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])|(?<![\w_])_(?!\s)([^_\n]+?)_(?![\w_])|(?<![\w-])-(?!\s)([^-\n]+?)-(?![\w-])/g;

function inline(source: string, options: JiraWikiOptions): RichTextNode[] {
  const out: RichTextNode[] = [];
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    if (match.index > last) out.push(b.text(source.slice(last, match.index)));
    last = match.index + match[0].length;
    const [, mono, user, label, href, bare, bold, italic, strike] = match;
    if (mono) out.push(b.text(mono, [{ type: 'code' }]));
    else if (user) {
      const found = options.resolveUser?.(user.replace(/^accountid:/, ''));
      out.push(
        found
          ? { type: 'mention', attrs: { id: found.id, label: found.label } }
          : b.text(`@${user}`),
      );
    } else if (label && href) {
      out.push(SAFE_LINK.test(href) ? b.text(label, [b.linkMark(href)]) : b.text(label));
    } else if (bare) out.push(b.text(bare, [b.linkMark(bare)]));
    else if (bold) out.push(b.text(bold, [{ type: 'bold' }]));
    else if (italic) out.push(b.text(italic, [{ type: 'italic' }]));
    else if (strike) out.push(b.text(strike, [{ type: 'strike' }]));
  }
  if (last < source.length) out.push(b.text(source.slice(last)));
  return b.normalizeInline(out);
}

interface ListFrame {
  ordered: boolean;
  node: RichTextNode;
}

export function fromJiraWiki(markup: string | null | undefined, options: JiraWikiOptions = {}) {
  const blocks: RichTextNode[] = [];
  const lines = (markup ?? '').replace(/\r\n?/g, '\n').split('\n');
  let paragraph: string[] = [];
  let lists: ListFrame[] = [];

  const flushParagraph = () => {
    const text = paragraph.join('\n').trim();
    if (text) {
      const parts = text.split('\n');
      const content = parts.flatMap((part, index) =>
        index === 0 ? inline(part, options) : [{ type: 'hardBreak' }, ...inline(part, options)],
      );
      blocks.push(b.paragraph(content));
    }
    paragraph = [];
  };
  const closeLists = () => {
    lists = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const block = BLOCK_START.exec(line.trim());
    if (block) {
      flushParagraph();
      closeLists();
      const kind = block[1]!;
      const body: string[] = block[2] ? [block[2]] : [];
      const end = new RegExp(`^(.*)\\{${kind}\\}\\s*$`);
      for (index += 1; index < lines.length; index += 1) {
        const closing = end.exec(lines[index] ?? '');
        if (closing) {
          if (closing[1]) body.push(closing[1]);
          break;
        }
        body.push(lines[index] ?? '');
      }
      blocks.push(b.codeBlock(body.join('\n'), null));
      continue;
    }
    const heading = HEADING.exec(line.trim());
    const list = LIST.exec(line.trim());
    const quote = QUOTE.exec(line.trim());
    if (heading) {
      flushParagraph();
      closeLists();
      const level = Math.min(3, Number(heading[1]));
      blocks.push({ type: 'heading', attrs: { level }, content: inline(heading[2]!, options) });
    } else if (list && !line.trim().startsWith('----')) {
      flushParagraph();
      const depth = Math.min(list[1]!.length, lists.length + 1);
      const ordered = list[1]!.endsWith('#');
      const item: RichTextNode = {
        type: 'listItem',
        content: [b.paragraph(inline(list[2]!, options))],
      };
      while (lists.length > depth) lists.pop();
      if (lists.length === depth && lists[depth - 1]?.ordered !== ordered) lists.pop();
      if (lists.length < depth) {
        const node: RichTextNode = ordered
          ? { type: 'orderedList', attrs: { start: 1, type: null }, content: [] }
          : { type: 'bulletList', content: [] };
        const parentItem = lists.at(-1)?.node.content?.at(-1);
        if (parentItem) parentItem.content!.push(node);
        else blocks.push(node);
        lists.push({ ordered, node });
      }
      lists.at(-1)!.node.content!.push(item);
    } else if (quote) {
      flushParagraph();
      closeLists();
      blocks.push({ type: 'blockquote', content: [b.paragraph(inline(quote[1]!, options))] });
    } else if (line.trim() === '----') {
      flushParagraph();
      closeLists();
      blocks.push({ type: 'horizontalRule' });
    } else if (!line.trim()) {
      flushParagraph();
      closeLists();
    } else {
      closeLists();
      paragraph.push(line);
    }
  }
  flushParagraph();
  return finish(blocks) satisfies RichTextDoc;
}
