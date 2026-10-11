import { SAFE_IMAGE_SRC } from '../schema/nodes/image.ts';
import type { RichTextDoc, RichTextNode } from '../types.ts';
import * as b from './build.ts';
import { finish } from './finish.ts';
import { SAFE_LINK } from './options.ts';

/*
 * Atlassian Document Format (the JSON Jira Cloud stores descriptions and comments in) to
 * ProseMirror JSON. Nodes and marks the schema has map one to one; mentions and media resolve
 * through the importer's callbacks, since only it knows who and what they became; a node the
 * schema cannot hold becomes a labelled unsupported block, so nothing is silently dropped.
 */

export interface AdfNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: AdfNode[];
}

export interface AdfOptions {
  /** A source account id as a Bemmoly person. */
  resolveUser?: (accountId: string, shown: string) => { id: string; label: string } | null;
  /** A media node's id (or file name) as the URL it was uploaded to. */
  resolveMedia?: (id: string, alt: string) => string | null;
  /** An issue URL or key at the source as the key it has here, for live embeds. */
  resolveIssueKey?: (url: string) => string | null;
}

const ISSUE_KEY = /^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$/;
const INLINE = new Set(['text', 'hardBreak', 'mention', 'pageLink', 'issueEmbed']);
const isInline = (node: RichTextNode) => INLINE.has(node.type);
const PANELS: Record<string, string> = {
  info: 'info',
  note: 'note',
  success: 'success',
  warning: 'warning',
  error: 'danger',
  tip: 'success',
  custom: 'note',
};
const MARKS: Record<string, string> = {
  strong: 'bold',
  em: 'italic',
  strike: 'strike',
  code: 'code',
};

const str = (value: unknown) => (typeof value === 'string' ? value : '');

function marksOf(node: AdfNode): b.Mark[] {
  const marks: b.Mark[] = [];
  for (const mark of node.marks ?? []) {
    const mapped = MARKS[mark.type];
    if (mapped) marks.push({ type: mapped });
    if (mark.type === 'link') {
      const href = str(mark.attrs?.['href']);
      if (SAFE_LINK.test(href)) marks.push(b.linkMark(href));
    }
  }
  return marks;
}

/** Unknown or schema-less nodes, kept whole and labelled where they stood. */
function unsupported(node: AdfNode): RichTextNode {
  return {
    type: 'unsupportedBlock',
    attrs: { source: 'jira', name: node.type, raw: JSON.stringify(node).slice(0, 20_000) },
  };
}

export function fromAdf(input: unknown, options: AdfOptions = {}): RichTextDoc {
  const root = (input && typeof input === 'object' ? input : null) as AdfNode | null;

  const blocks = (nodes: AdfNode[] | undefined): RichTextNode[] =>
    b.wrapLoose((nodes ?? []).flatMap(convert), isInline);
  const inline = (nodes: AdfNode[] | undefined): RichTextNode[] =>
    b.normalizeInline((nodes ?? []).flatMap(convert).filter(isInline));
  const itemBody = (content: RichTextNode[]) =>
    content[0]?.type === 'paragraph' ? content : [b.paragraph(), ...content];

  function card(node: AdfNode): RichTextNode[] {
    const url = str(node.attrs?.['url']);
    const key = options.resolveIssueKey?.(url) ?? null;
    if (key && ISSUE_KEY.test(key)) return [{ type: 'issueEmbed', attrs: { key } }];
    return SAFE_LINK.test(url) ? [b.text(url, [b.linkMark(url)])] : [];
  }

  function media(node: AdfNode): RichTextNode[] {
    const attrs = node.attrs ?? {};
    const alt = str(attrs['alt']) || str(attrs['__fileName']);
    const external = str(attrs['url']);
    const src = external || options.resolveMedia?.(str(attrs['id']), alt) || '';
    if (src && SAFE_IMAGE_SRC.test(src)) return [b.image(src, alt)];
    return alt ? [b.paragraph([b.text(`[${alt}]`)])] : [];
  }

  function table(node: AdfNode): RichTextNode[] {
    const rows = (node.content ?? [])
      .filter((row) => row.type === 'tableRow')
      .map((row) => ({
        type: 'tableRow',
        content: (row.content ?? []).map((cell) =>
          b.cell(cell.type === 'tableHeader', blocks(cell.content)),
        ),
      }))
      .filter((row) => row.content.length > 0);
    return rows.length ? [{ type: 'table', content: rows }] : [];
  }

  function convert(node: AdfNode): RichTextNode[] {
    const attrs = node.attrs ?? {};
    switch (node.type) {
      case 'text':
        return node.text ? [b.text(node.text, marksOf(node))] : [];
      case 'paragraph':
        return [b.paragraph(inline(node.content))];
      case 'heading':
        return [
          {
            type: 'heading',
            attrs: { level: Math.min(3, Math.max(1, Number(attrs['level']) || 1)) },
            content: inline(node.content),
          },
        ];
      case 'hardBreak':
        return [{ type: 'hardBreak' }];
      case 'rule':
        return [{ type: 'horizontalRule' }];
      case 'bulletList':
        return [{ type: 'bulletList', content: (node.content ?? []).flatMap(convert) }];
      case 'orderedList':
        return [
          {
            type: 'orderedList',
            attrs: { start: Number(attrs['order']) || 1, type: null },
            content: (node.content ?? []).flatMap(convert),
          },
        ];
      case 'listItem':
        return [{ type: 'listItem', content: itemBody(blocks(node.content)) }];
      case 'taskList':
        return [{ type: 'taskList', content: (node.content ?? []).flatMap(convert) }];
      case 'taskItem':
        return [
          {
            type: 'taskItem',
            attrs: { checked: attrs['state'] === 'DONE' },
            content: [b.paragraph(inline(node.content))],
          },
        ];
      case 'blockquote':
        return [{ type: 'blockquote', content: blocks(node.content) }];
      case 'codeBlock': {
        const code = (node.content ?? []).map((child) => child.text ?? '').join('');
        return [b.codeBlock(code, str(attrs['language']) || null)];
      }
      case 'panel': {
        const content = blocks(node.content);
        const variant = PANELS[str(attrs['panelType'])] ?? 'note';
        return [{ type: 'callout', attrs: { variant }, content: itemBody(content) }];
      }
      case 'expand':
      case 'nestedExpand':
      case 'layoutSection':
      case 'layoutColumn':
      case 'bodiedExtension': {
        const title = str(attrs['title']);
        const heading = title ? [b.paragraph([b.text(title, [{ type: 'bold' }])])] : [];
        return [...heading, ...blocks(node.content)];
      }
      case 'mention': {
        const id = str(attrs['id']);
        const shown = str(attrs['text']).replace(/^@/, '');
        const found = options.resolveUser?.(id, shown);
        if (found) return [{ type: 'mention', attrs: { id: found.id, label: found.label } }];
        return [b.text(`@${shown || 'someone'}`)];
      }
      case 'emoji':
        return [b.text(str(attrs['text']) || str(attrs['shortName']))];
      case 'status':
      case 'placeholder':
        return str(attrs['text']) ? [b.text(str(attrs['text']), [{ type: 'bold' }])] : [];
      case 'date': {
        const at = Number(attrs['timestamp']);
        return Number.isFinite(at) ? [b.text(new Date(at).toISOString().slice(0, 10))] : [];
      }
      case 'inlineCard':
      case 'blockCard':
      case 'embedCard':
        return card(node);
      case 'mediaSingle':
      case 'mediaGroup':
        return (node.content ?? []).flatMap(convert);
      case 'media':
      case 'mediaInline':
        return media(node);
      case 'table':
        return table(node);
      default:
        return [unsupported(node)];
    }
  }

  if (!root || root.type !== 'doc') return finish([]);
  return finish(blocks(root.content));
}
