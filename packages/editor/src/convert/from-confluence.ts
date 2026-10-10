import { SAFE_IMAGE_SRC } from '../schema/nodes/image.ts';
import type { RichTextDoc, RichTextNode } from '../types.ts';
import * as b from './build.ts';
import {
  attribute,
  childElements,
  childrenOf,
  isElement,
  parseStorage,
  tagName,
  textContent,
  type DomNode,
} from './confluence-dom.ts';
import { MACROS, unsupported } from './confluence-macros.ts';
import { finish } from './finish.ts';
import { SAFE_LINK } from './options.ts';

/*
 * Confluence storage format (the XHTML Confluence stores and exports) to ProseMirror JSON.
 * HTML elements map to their nodes and marks; `ac:` macros map through confluence-macros.ts;
 * links to pages and people resolve through the importer's callbacks, since only it knows
 * which Bemmoly page or person a Confluence title or account became. A macro with no node
 * becomes a labelled unsupported block, so nothing is silently dropped.
 */

export interface ConfluenceOptions {
  /** A Confluence page title (and space key, when it names one) as a Bemmoly page. */
  resolvePage?: (title: string, spaceKey: string) => { pageId: string; title: string } | null;
  /** A Confluence account id as a Bemmoly person. */
  resolveUser?: (accountId: string) => { id: string; label: string } | null;
  /** An attachment's file name as the URL it was uploaded to. */
  resolveAttachment?: (fileName: string) => string | null;
}

const INLINE = new Set(['text', 'hardBreak', 'mention', 'pageLink', 'issueEmbed']);
const isInline = (node: RichTextNode) => INLINE.has(node.type);
const MARKS: Record<string, string> = {
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  s: 'strike',
  del: 'strike',
  strike: 'strike',
  mark: 'highlight',
  code: 'code',
};
const HEADINGS: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 3, h5: 3, h6: 3 };

export function fromConfluence(xhtml: string, options: ConfluenceOptions = {}): RichTextDoc {
  const blocks = (nodes: DomNode[]): RichTextNode[] =>
    trimParagraphs(
      b.wrapLoose(
        nodes.flatMap((node) => convert(node, [])),
        isInline,
      ),
    );
  const body = (node: DomNode | undefined) => (node ? blocks(childrenOf(node)) : []);
  const inlineOnly = (nodes: DomNode[], marks: b.Mark[]) =>
    b.normalizeInline(nodes.flatMap((node) => convert(node, marks)).filter(isInline));

  function link(node: DomNode, marks: b.Mark[]): RichTextNode[] {
    const page = childElements(node, 'ri:page')[0];
    const user = childElements(node, 'ri:user')[0];
    const shown =
      childElements(node, 'ac:link-body')[0] ?? childElements(node, 'ac:plain-text-link-body')[0];
    const label = shown ? textContent(shown).trim() : '';
    if (page) {
      const title = attribute(page, 'ri:content-title');
      const found = options.resolvePage?.(title, attribute(page, 'ri:space-key'));
      if (found) return [{ type: 'pageLink', attrs: { pageId: found.pageId, title: found.title } }];
      return [b.text(label || title, marks)];
    }
    if (user) {
      const found = options.resolveUser?.(attribute(user, 'ri:account-id'));
      if (found) return [{ type: 'mention', attrs: { id: found.id, label: found.label } }];
      return [b.text(`@${label || 'someone'}`, marks)];
    }
    return label ? [b.text(label, marks)] : [];
  }

  function image(node: DomNode): RichTextNode[] {
    const url = attribute(childElements(node, 'ri:url')[0] ?? node, 'ri:value');
    const file = attribute(childElements(node, 'ri:attachment')[0] ?? node, 'ri:filename');
    const src = url || (file ? (options.resolveAttachment?.(file) ?? '') : '');
    const alt = attribute(node, 'ac:alt') || attribute(node, 'ac:title') || file;
    return SAFE_IMAGE_SRC.test(src) ? [b.image(src, alt)] : alt ? [b.text(alt)] : [];
  }

  function listItems(node: DomNode): RichTextNode[] {
    return childElements(node, 'li').map((li) => {
      const content = blocks(childrenOf(li));
      return {
        type: 'listItem',
        content: content[0]?.type === 'paragraph' ? content : [b.paragraph(), ...content],
      };
    });
  }

  function tasks(node: DomNode): RichTextNode {
    const items = childElements(node, 'ac:task').map((task) => {
      const status = textContent(childElements(task, 'ac:task-status')[0] ?? task).trim();
      const content = body(childElements(task, 'ac:task-body')[0]);
      return {
        type: 'taskItem',
        attrs: { checked: status === 'complete' },
        content: content[0]?.type === 'paragraph' ? content : [b.paragraph(), ...content],
      };
    });
    return { type: 'taskList', content: items.length ? items : [] };
  }

  function table(node: DomNode): RichTextNode[] {
    const rows = childrenOf(node)
      .flatMap((child) =>
        tagName(child) === 'tbody' || tagName(child) === 'thead' ? childrenOf(child) : [child],
      )
      .filter((child) => tagName(child) === 'tr')
      .map((tr) => ({
        type: 'tableRow',
        content: childrenOf(tr)
          .filter((td) => tagName(td) === 'td' || tagName(td) === 'th')
          .map((td) => b.cell(tagName(td) === 'th', blocks(childrenOf(td)))),
      }))
      .filter((row) => row.content.length > 0);
    return rows.length ? [{ type: 'table', content: rows }] : [];
  }

  function convert(node: DomNode, marks: b.Mark[]): RichTextNode[] {
    if (node.type === 'text') {
      const value = textContent(node).replace(/\s+/g, ' ');
      return value.trim() || marks.length ? [b.text(value, marks)] : value ? [b.text(' ')] : [];
    }
    if (!isElement(node)) return [];
    const name = tagName(node);
    const mark = MARKS[name];
    if (mark)
      return childrenOf(node).flatMap((child) => convert(child, [...marks, { type: mark }]));
    switch (name) {
      case 'p':
        return b.wrapLoose(
          childrenOf(node).flatMap((child) => convert(child, [])),
          isInline,
        );
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return [
          {
            type: 'heading',
            attrs: { level: HEADINGS[name] },
            content: inlineOnly(childrenOf(node), []),
          },
        ];
      case 'br':
        return [{ type: 'hardBreak' }];
      case 'hr':
        return [{ type: 'horizontalRule' }];
      case 'a': {
        const href = attribute(node, 'href');
        const linked = SAFE_LINK.test(href) ? [...marks, b.linkMark(href)] : marks;
        return childrenOf(node).flatMap((child) => convert(child, linked));
      }
      case 'ul':
        return [{ type: 'bulletList', content: listItems(node) }];
      case 'ol':
        return [{ type: 'orderedList', attrs: { start: 1, type: null }, content: listItems(node) }];
      case 'blockquote':
        return [{ type: 'blockquote', content: blocks(childrenOf(node)) }];
      case 'pre':
        return [b.codeBlock(textContent(node).replace(/\n$/, ''), null)];
      case 'table':
        return table(node);
      case 'ac:task-list':
        return [tasks(node)];
      case 'ac:link':
        return link(node, marks);
      case 'ac:image':
        return image(node);
      case 'ac:emoticon':
        return [b.text(attribute(node, 'ac:emoji-fallback') || '', marks)];
      case 'time':
        return [b.text(attribute(node, 'datetime'), marks)];
      case 'ac:structured-macro':
      case 'ac:macro': {
        const convertMacro = MACROS[attribute(node, 'ac:name')];
        return convertMacro ? convertMacro(node, body) : [unsupported(node)];
      }
      case 'ac:placeholder':
      case 'script':
      case 'style':
        return [];
      default:
        return childrenOf(node).flatMap((child) => convert(child, marks));
    }
  }

  return finish(blocks(parseStorage(xhtml)));
}

/**
 * Source indentation is not text: a paragraph loses the spaces at its ends, and one made only
 * of the whitespace between block elements is dropped.
 */
function trimParagraphs(nodes: RichTextNode[]): RichTextNode[] {
  return nodes.flatMap((node) => {
    if (node.type !== 'paragraph' && node.type !== 'heading') return [node];
    const content = [...(node.content ?? [])];
    const first = content[0];
    if (first?.type === 'text') content[0] = { ...first, text: first.text?.trimStart() ?? '' };
    const last = content[content.length - 1];
    if (last?.type === 'text') {
      content[content.length - 1] = { ...last, text: last.text?.trimEnd() ?? '' };
    }
    const kept = content.filter((child) => child.type !== 'text' || child.text);
    if (node.type === 'heading') return [{ ...node, content: kept }];
    return kept.length ? [{ ...node, content: kept }] : [];
  });
}
