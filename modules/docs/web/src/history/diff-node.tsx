import type { DiffNode } from '@bemmoly/module-docs/shared';
import type { ReactNode } from 'react';
import { InlineContent } from './diff-inline.tsx';

/*
 * The elements a compare prints a block as. Containers (lists, quotes, tables) draw as the
 * elements the editor uses, so the shared prose styles apply; their changed children are
 * drawn inside them. Docs nodes without a reading form here print as a labelled frame
 * around their text, so nothing vanishes from a compare.
 */

const TEXT_BLOCKS = new Set(['paragraph', 'heading', 'codeBlock']);

export const BLOCK_NAMES: Record<string, string> = {
  paragraph: 'Paragraph',
  heading: 'Heading',
  bulletList: 'Bulleted list',
  orderedList: 'Numbered list',
  taskList: 'Checklist',
  listItem: 'List item',
  taskItem: 'Checklist item',
  blockquote: 'Quote',
  codeBlock: 'Code block',
  table: 'Table',
  tableRow: 'Table row',
  tableCell: 'Table cell',
  tableHeader: 'Table header cell',
  horizontalRule: 'Divider',
  image: 'Image',
  callout: 'Callout',
  issueEmbed: 'Issue',
  issueTable: 'Issue table',
  decision: 'Decision',
};

export const blockName = (type: string) =>
  BLOCK_NAMES[type] ?? type.replace(/([A-Z])/g, ' $1').toLowerCase();

/** Attributes a compare puts on a block's element: its op, an id to link a move by. */
export interface ShellProps {
  'data-op'?: string;
  id?: string;
}

/** Wraps a block's content in the element its type prints as. */
export function blockShell(
  node: Pick<DiffNode, 'type' | 'attrs'>,
  children: ReactNode,
  extra: ShellProps = {},
): ReactNode {
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case 'paragraph':
      return <p {...extra}>{children}</p>;
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(attrs['level'] ?? 2)));
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
      return <Tag {...extra}>{children}</Tag>;
    }
    case 'codeBlock':
      return (
        <pre {...extra}>
          <code>{children}</code>
        </pre>
      );
    case 'bulletList':
      return <ul {...extra}>{children}</ul>;
    case 'orderedList':
      return <ol {...extra}>{children}</ol>;
    case 'taskList':
      return (
        <ul data-type="taskList" {...extra}>
          {children}
        </ul>
      );
    case 'listItem':
      return <li {...extra}>{children}</li>;
    case 'taskItem':
      return (
        <li data-checked={String(Boolean(attrs['checked']))} {...extra}>
          <label aria-hidden>
            <input type="checkbox" readOnly checked={Boolean(attrs['checked'])} tabIndex={-1} />
          </label>
          <div>{children}</div>
        </li>
      );
    case 'blockquote':
      return <blockquote {...extra}>{children}</blockquote>;
    case 'table':
      return (
        <div className="overflow-auto" {...extra}>
          <table className="w-full border-collapse text-13">
            <tbody>{children}</tbody>
          </table>
        </div>
      );
    case 'tableRow':
      return <tr {...extra}>{children}</tr>;
    case 'tableCell':
      return (
        <td className="border border-line px-2 py-1 align-top" {...extra}>
          {children}
        </td>
      );
    case 'tableHeader':
      return (
        <th
          className="border border-line bg-side px-2 py-1 text-left align-top font-semibold"
          {...extra}
        >
          {children}
        </th>
      );
    case 'horizontalRule':
      return <hr className="border-line" {...extra} />;
    default:
      return (
        <div
          className="flex flex-col gap-1 rounded-control border border-line bg-side px-3 py-2"
          {...extra}
        >
          <span className="text-11 font-medium tracking-caps text-tx-3 uppercase">
            {blockName(node.type)}
          </span>
          {children}
        </div>
      );
  }
}

/** A whole block as it reads, for the blocks a compare shows unchanged, added or removed. */
export function StaticNode({ node, extra }: { node: DiffNode; extra?: ShellProps }): ReactNode {
  if (
    TEXT_BLOCKS.has(node.type) ||
    node.content?.every((child) => typeof child.text === 'string')
  ) {
    return blockShell(node, <InlineContent nodes={node.content} />, extra);
  }
  if (node.type === 'image') {
    const alt = String(node.attrs?.['alt'] ?? '');
    return blockShell(node, <span className="text-tx-3">{alt || 'An image'}</span>, extra);
  }
  return blockShell(
    node,
    (node.content ?? []).map((child, index) => <StaticNode key={index} node={child} />),
    extra,
  );
}

/** Whether a block's content is text runs, so a change to it reads as inline runs. */
export const isTextBlock = (type: string) => TEXT_BLOCKS.has(type);
