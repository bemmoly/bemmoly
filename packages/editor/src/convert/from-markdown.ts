import { decodeHTML } from 'entities';
import { Lexer, type Token, type Tokens } from 'marked';
import { CALLOUT_VARIANTS } from '../schema/nodes/callout.ts';
import { codeLanguage } from '../schema/nodes/code-block.ts';
import { DECISION_LABELS, DECISION_STATES } from '../schema/nodes/decision.ts';
import { SAFE_IMAGE_SRC } from '../schema/nodes/image.ts';
import type { RichTextDoc, RichTextNode } from '../types.ts';
import * as b from './build.ts';
import { finish } from './finish.ts';
import { SAFE_LINK } from './options.ts';

/*
 * Markdown (CommonMark with GitHub's tables, task lists and strikethrough) to ProseMirror
 * JSON. It reads back what toMarkdown writes: alert quotes ("> [!WARNING]") as callouts,
 * "**Decision: …**" quotes as decisions and `lql` fences as issue tables. Raw HTML is
 * dropped to its text; images inside a paragraph are lifted out as image blocks.
 */

/** GitHub's alert names, and ours, as callout variants. */
const ALERTS: Record<string, string> = {
  ...Object.fromEntries(CALLOUT_VARIANTS.map((variant) => [variant.toUpperCase(), variant])),
  TIP: 'success',
  IMPORTANT: 'info',
  CAUTION: 'danger',
};

const DECISION = new RegExp(
  `^Decision: (${Object.values(DECISION_LABELS).join('|')})(?: · (\\S+))?$`,
);

function inline(tokens: Token[] | undefined, marks: b.Mark[] = []): RichTextNode[] {
  return (tokens ?? []).flatMap((token): RichTextNode[] => {
    const t = token as Tokens.Generic;
    const nested = (mark: b.Mark) => inline(t.tokens, [...marks, mark]);
    switch (token.type) {
      case 'text':
        return t.tokens?.length ? inline(t.tokens, marks) : [b.text(decodeHTML(t.text), marks)];
      case 'escape':
        return [b.text(t.text, marks)];
      case 'strong':
        return nested({ type: 'bold' });
      case 'em':
        return nested({ type: 'italic' });
      case 'del':
        return nested({ type: 'strike' });
      case 'codespan':
        return [b.text(decodeHTML(t.text), [...marks, { type: 'code' }])];
      case 'br':
        return [{ type: 'hardBreak' }];
      case 'link':
        return SAFE_LINK.test(t.href) ? nested(b.linkMark(t.href)) : inline(t.tokens, marks);
      case 'image':
        return SAFE_IMAGE_SRC.test(t.href) ? [b.image(t.href, t.text, t.title ?? null)] : [];
      default:
        return [];
    }
  });
}

const isInline = (node: RichTextNode) => node.type !== 'image';

/** A paragraph's inline content, with any images lifted out beside it. */
const paragraphs = (tokens: Token[] | undefined) => b.wrapLoose(inline(tokens), isInline);

function listItem(item: Tokens.ListItem, task: boolean): RichTextNode {
  const content = blocks(item.tokens.filter((token) => token.type !== 'checkbox'));
  return {
    type: task ? 'taskItem' : 'listItem',
    ...(task ? { attrs: { checked: Boolean(item.checked) } } : {}),
    content: content[0]?.type === 'paragraph' ? content : [b.paragraph(), ...content],
  };
}

function quote(token: Tokens.Blockquote): RichTextNode[] {
  const first = token.tokens[0];
  const lead = first?.type === 'paragraph' ? (first as Tokens.Paragraph).text : '';
  const alert = /^\[!(\w+)\][ \t]*\n?/.exec(lead);
  const variant = alert ? ALERTS[alert[1]!.toUpperCase()] : undefined;
  if (variant) {
    const rest = Lexer.lex(token.text.slice(alert![0].length));
    const content = blocks(rest);
    return [
      { type: 'callout', attrs: { variant }, content: content.length ? content : [b.paragraph()] },
    ];
  }
  const decided = /^\*\*(.+)\*\*$/.exec(lead.trim());
  const heading = decided ? DECISION.exec(decided[1]!) : null;
  if (heading) {
    const state = DECISION_STATES.find((key) => DECISION_LABELS[key] === heading[1]) ?? 'proposed';
    const content = blocks(token.tokens.slice(1));
    return [
      {
        type: 'decision',
        attrs: { state, decidedOn: heading[2] ?? null },
        content: content.length ? content : [b.paragraph()],
      },
    ];
  }
  return [{ type: 'blockquote', content: blocks(token.tokens) }];
}

function code(token: Tokens.Code): RichTextNode {
  const info = (token.lang ?? '').trim();
  if (/^lql\b/i.test(info)) {
    const title = /title="([^"]*)"/.exec(info)?.[1] ?? '';
    return { type: 'issueTable', attrs: { query: token.text.trim(), title } };
  }
  const lang = info.split(/\s+/)[0] ?? '';
  return b.codeBlock(token.text, lang ? (codeLanguage(lang) ?? lang) : null);
}

function table(token: Tokens.Table): RichTextNode {
  const row = (cells: Tokens.TableCell[], header: boolean): RichTextNode => ({
    type: 'tableRow',
    content: cells.map((cell) => b.cell(header, paragraphs(cell.tokens))),
  });
  const headed = token.header.some((cell) => cell.text.trim());
  return {
    type: 'table',
    content: [
      ...(headed ? [row(token.header, true)] : []),
      ...token.rows.map((cells) => row(cells, false)),
    ],
  };
}

function blocks(tokens: Token[]): RichTextNode[] {
  return tokens.flatMap((token): RichTextNode[] => {
    switch (token.type) {
      case 'paragraph':
        return paragraphs((token as Tokens.Paragraph).tokens);
      case 'text': {
        const t = token as Tokens.Text;
        return paragraphs(t.tokens ?? [{ type: 'text', raw: t.raw, text: t.text }]);
      }
      case 'heading': {
        const h = token as Tokens.Heading;
        const level = Math.min(3, h.depth);
        return [
          { type: 'heading', attrs: { level }, content: b.normalizeInline(inline(h.tokens)) },
        ];
      }
      case 'list': {
        const list = token as Tokens.List;
        const task = list.items.length > 0 && list.items.every((item) => item.task);
        if (task) return [{ type: 'taskList', content: list.items.map((i) => listItem(i, true)) }];
        const content = list.items.map((item) => listItem(item, false));
        if (!list.ordered) return [{ type: 'bulletList', content }];
        const start = Number(list.start) || 1;
        return [{ type: 'orderedList', attrs: { start, type: null }, content }];
      }
      case 'blockquote':
        return quote(token as Tokens.Blockquote);
      case 'code':
        return [code(token as Tokens.Code)];
      case 'hr':
        return [{ type: 'horizontalRule' }];
      case 'table':
        return [table(token as Tokens.Table)];
      case 'html': {
        const plain = htmlText((token as Tokens.HTML).text);
        return plain ? [b.paragraph([b.text(plain)])] : [];
      }
      default:
        return [];
    }
  });
}

/**
 * The words of a raw HTML block, kept as plain text. Entities are decoded first and tags are
 * stripped until none are left, so nested or entity-encoded markup cannot survive as a tag;
 * a stray angle bracket from a broken tag goes too.
 */
export function htmlText(html: string): string {
  let text = decodeHTML(html);
  for (let previous = ''; previous !== text;) {
    previous = text;
    text = text.replace(/<[^<>]*>/g, '');
  }
  return text.replace(/[<>]/g, '').trim();
}

/** Markdown as a document in the editor's schema. */
export function fromMarkdown(markdown: string): RichTextDoc {
  return finish(blocks(Lexer.lex(markdown, { gfm: true })));
}
