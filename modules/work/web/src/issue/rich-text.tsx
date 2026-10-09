import type { RichText } from '@bemmoly/module-work/shared';
import type { ReactNode } from 'react';
import { cx } from './cx.ts';
import type { PmNode } from './rich-text-convert.ts';

/*
 * A ProseMirror document as the Issue mock prints a description: 10px between blocks,
 * lists indented 20px with 4px between items, inline code on the chip tint in mono.
 */

function marked(text: ReactNode, marks: PmNode['marks'], key: number): ReactNode {
  return (marks ?? []).reduce<ReactNode>((inner, mark) => {
    switch (mark.type) {
      case 'bold':
        return <b key={key}>{inner}</b>;
      case 'italic':
        return <i key={key}>{inner}</i>;
      case 'code':
        return (
          <code
            key={key}
            className="rounded-chip bg-chip px-1.25 py-px font-mono text-12h font-medium"
          >
            {inner}
          </code>
        );
      case 'link': {
        const href = String(mark.attrs?.['href'] ?? '');
        return /^(https?:|mailto:|\/)/.test(href) ? (
          <a key={key} href={href} rel="noreferrer">
            {inner}
          </a>
        ) : (
          inner
        );
      }
      default:
        return inner;
    }
  }, text);
}

function inline(nodes: PmNode[] | undefined): ReactNode[] {
  return (nodes ?? []).map((node, index) => {
    if (node.type === 'hardBreak') return <br key={index} />;
    if (node.type === 'mention') {
      return (
        <span key={index} className="font-medium text-ac">
          @{String(node.attrs?.['label'] ?? '')}
        </span>
      );
    }
    if (typeof node.text === 'string') return marked(node.text, node.marks, index);
    return <span key={index}>{inline(node.content)}</span>;
  });
}

function block(node: PmNode, index: number): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return (
        <p key={index} className="m-0">
          {inline(node.content)}
        </p>
      );
    case 'heading':
      return (
        <p key={index} className="m-0 font-semibold">
          {inline(node.content)}
        </p>
      );
    case 'bulletList':
    case 'orderedList': {
      const List = node.type === 'bulletList' ? 'ul' : 'ol';
      return (
        <List
          key={index}
          className={cx(
            'm-0 flex flex-col gap-1 pl-5',
            node.type === 'bulletList' ? 'list-disc' : 'list-decimal',
          )}
        >
          {(node.content ?? []).map((item, i) => (
            <li key={i}>{(item.content ?? []).map((child) => inline(child.content))}</li>
          ))}
        </List>
      );
    }
    case 'taskList':
      return (
        <ul key={index} className="m-0 flex list-none flex-col gap-1 p-0">
          {(node.content ?? []).map((item, i) => {
            const checked = Boolean(item.attrs?.['checked']);
            return (
              <li key={i} className="flex items-start gap-2">
                <span aria-hidden className="font-mono text-tx4">
                  {checked ? '☑' : '☐'}
                </span>
                <span className={cx(checked && 'text-tx5 line-through')}>
                  <span className="sr-only">{checked ? 'Done: ' : 'Open: '}</span>
                  {(item.content ?? []).map((child) => inline(child.content))}
                </span>
              </li>
            );
          })}
        </ul>
      );
    case 'blockquote':
      return (
        <blockquote key={index} className="m-0 border-l-3 border-br3 pl-3 text-tx3">
          {(node.content ?? []).map(block)}
        </blockquote>
      );
    case 'codeBlock':
      return (
        <pre
          key={index}
          className="m-0 overflow-auto rounded-sm bg-chip px-3 py-2 font-mono text-12h whitespace-pre-wrap"
        >
          {inline(node.content)}
        </pre>
      );
    case 'horizontalRule':
      return <hr key={index} className="m-0 border-0 border-t border-br2" />;
    default:
      return (
        <p key={index} className="m-0">
          {inline(node.content)}
        </p>
      );
  }
}

export interface RichTextViewProps {
  doc: RichText | null | undefined;
  /** page: the Issue page (14px at 1.65). panel: the drawer (13px at 1.6 in tx2). comment: 13px. */
  size?: 'page' | 'panel' | 'comment';
  className?: string;
}

export function RichTextView({ doc, size = 'page', className }: RichTextViewProps) {
  const nodes = (doc as PmNode | null | undefined)?.content ?? [];
  return (
    <div
      className={cx(
        'flex min-w-0 flex-col break-words',
        size === 'page' && 'gap-2.5 text-14 leading-doc text-tx-body',
        size === 'panel' && 'gap-2.5 text-13 leading-desc text-tx2',
        size === 'comment' && 'gap-1.5',
        className,
      )}
    >
      {nodes.map(block)}
    </div>
  );
}
