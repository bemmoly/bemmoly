import type { DiffMark, DiffNode, InlinePart } from '@bemmoly/module-docs/shared';
import { Fragment, type ReactNode } from 'react';
import { cx } from '../comments/cx.ts';

/*
 * Inline content of a compare: text with its marks, and the runs of a changed block, where
 * inserted words sit on the ok tint, deleted ones struck through on the danger tint, and
 * words whose formatting changed carry a dotted caution underline that names the change.
 * Links print as text: a compare is for reading what changed, not for leaving the page.
 */

const MARK_NAMES: Record<string, string> = {
  bold: 'bold',
  italic: 'italic',
  strike: 'strikethrough',
  code: 'code',
  link: 'link',
  underline: 'underline',
  highlight: 'highlight',
};

export const INSERT_CLASS = 'rounded-xs bg-ok-bg text-ok-fg no-underline';
export const DELETE_CLASS = 'rounded-xs bg-danger/10 text-danger line-through decoration-danger/60';
export const FORMAT_CLASS =
  'underline decoration-caution decoration-dotted decoration-2 underline-offset-3';

function withMarks(content: ReactNode, marks: readonly DiffMark[]): ReactNode {
  return marks.reduce<ReactNode>((inner, mark) => {
    switch (mark.type) {
      case 'bold':
        return <strong>{inner}</strong>;
      case 'italic':
        return <em>{inner}</em>;
      case 'strike':
        return <s>{inner}</s>;
      case 'code':
        return <code>{inner}</code>;
      case 'underline':
        return <u>{inner}</u>;
      case 'link':
        return (
          <span
            className="text-ac underline decoration-ac/40 underline-offset-2"
            title={String(mark.attrs?.['href'] ?? '')}
          >
            {inner}
          </span>
        );
      default:
        return inner;
    }
  }, content);
}

/** An inline node as reading text: a mention by name, a page link by title, a break as one. */
export function inlineNode(node: DiffNode): ReactNode {
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case 'hardBreak':
      return <br />;
    case 'mention':
      return <span data-type="mention">@{String(attrs['label'] ?? attrs['id'] ?? '')}</span>;
    case 'pageLink':
      return (
        <span className="text-ac">{String(attrs['title'] ?? attrs['label'] ?? 'Linked page')}</span>
      );
    case 'issueEmbed':
      return (
        <span className="font-mono text-tx2">
          {String(attrs['key'] ?? attrs['issueKey'] ?? 'Issue')}
        </span>
      );
    case 'emoji':
      return String(attrs['emoji'] ?? attrs['name'] ?? '');
    default:
      return node.text ?? '';
  }
}

/** Plain inline content (an equal block's text) with its marks. */
export function InlineContent({ nodes }: { nodes: readonly DiffNode[] | undefined }) {
  return (
    <>
      {(nodes ?? []).map((node, index) => (
        <Fragment key={index}>
          {withMarks(
            typeof node.text === 'string' ? node.text : inlineNode(node),
            node.marks ?? [],
          )}
        </Fragment>
      ))}
    </>
  );
}

/** "made bold, link removed": what a format run changed. */
export function formatChange(
  before: readonly DiffMark[] = [],
  after: readonly DiffMark[] = [],
): string {
  const had = new Set(before.map((mark) => mark.type));
  const has = new Set(after.map((mark) => mark.type));
  const name = (type: string) => MARK_NAMES[type] ?? type;
  const added = [...has].filter((type) => !had.has(type)).map((type) => `${name(type)} added`);
  const removed = [...had].filter((type) => !has.has(type)).map((type) => `${name(type)} removed`);
  const changed = [...has].filter((type) => had.has(type)).map((type) => `${name(type)} changed`);
  return [...added, ...removed, ...changed].join(', ') || 'formatting changed';
}

/** The runs of a block changed in place. */
export function InlineRuns({ parts }: { parts: readonly InlinePart[] }) {
  return (
    <>
      {parts.map((part, index) => {
        const content = withMarks(
          part.text ?? (part.node ? inlineNode(part.node) : ''),
          part.marks,
        );
        switch (part.op) {
          case 'insert':
            return (
              <ins key={index} className={INSERT_CLASS} data-op="insert">
                {content}
              </ins>
            );
          case 'delete':
            return (
              <del key={index} className={DELETE_CLASS} data-op="delete">
                {withMarks(part.text ?? (part.node ? inlineNode(part.node) : ''), part.marks)}
              </del>
            );
          case 'format': {
            const change = formatChange(part.beforeMarks, part.marks);
            return (
              <span
                key={index}
                className={cx(FORMAT_CLASS)}
                data-op="format"
                title={`Formatting: ${change}`}
              >
                {content}
                <span className="sr-only"> (formatting: {change})</span>
              </span>
            );
          }
          default:
            return <Fragment key={index}>{content}</Fragment>;
        }
      })}
    </>
  );
}
