import type { BlockDiff } from '@bemmoly/module-docs/shared';
import type { ReactNode } from 'react';
import { InlineContent, InlineRuns } from './diff-inline.tsx';
import { blockName, blockShell, StaticNode, type ShellProps } from './diff-node.tsx';

/*
 * One level of a structural diff, in reading order. Every block's element carries its op
 * (data-op), and the compare's container colours them, so a list item or a table row or a
 * single cell shows its change in place. A moved block names where it came from and links
 * to it; the place it left links forward to where it went.
 */

/** Ids for both ends of a move, unique per compare and per nesting level. */
export function moveIds(prefix: string, path: string, block: BlockDiff) {
  return {
    source: `${prefix}-from-${path}-${block.oldIndex ?? 'x'}`,
    destination: `${prefix}-to-${path}-${block.newIndex ?? 'x'}`,
  };
}

/** Scrolls to the other end of a move and makes it glow for a moment. */
export function jumpTo(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  target.dataset['flash'] = 'true';
  window.setTimeout(() => delete target.dataset['flash'], 1400);
}

/** "Heading 2 → 3", "checked → unchecked": attribute changes, for a title or a chip. */
export function attrSummary(block: BlockDiff): string | null {
  if (!block.attrs) return null;
  return Object.entries(block.attrs)
    .map(
      ([key, { before, after }]) =>
        `${key}: ${String(before ?? 'none')} → ${String(after ?? 'none')}`,
    )
    .join(', ');
}

const firstWords = (block: BlockDiff) => {
  const text = JSON.stringify(block.before ?? block.after ?? {})
    .match(/"text":"((?:[^"\\]|\\.)*)"/g)
    ?.map((part) => JSON.parse(part.slice(7)) as string)
    .join(' ')
    .trim();
  if (!text) return blockName(block.type);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
};

export interface MoveLinkProps {
  block: BlockDiff;
  target: string;
  /** move: this is where it is now. move_source: this is the place it left. */
  end: 'move' | 'move_source';
}

/** The line that ties the two ends of a move together. */
export function MoveLink({ block, target, end }: MoveLinkProps) {
  const down = (block.newIndex ?? 0) > (block.oldIndex ?? 0);
  const label =
    end === 'move'
      ? `Moved ${down ? 'down' : 'up'} · show where it was`
      : `Moved ${down ? 'down' : 'up'}: “${firstWords(block)}” · show where it went`;
  return (
    <button
      type="button"
      onClick={() => jumpTo(target)}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xs border-0 bg-transparent p-0 font-sans text-11h font-medium text-violet-fg hover:underline focus-ring"
    >
      <span aria-hidden>{down === (end === 'move') ? '↑' : '↓'}</span>
      {label}
    </button>
  );
}

const TABLE_PARTS = new Set(['table', 'tableRow', 'tableCell', 'tableHeader']);

/** A moved block unchanged inside: its own content as it reads. */
function InlineContentOf({ block }: { block: BlockDiff }) {
  return (
    <>
      {(block.after?.content ?? []).map((child, index) =>
        typeof child.text === 'string' || !child.content ? (
          <InlineContent key={index} nodes={[child]} />
        ) : (
          <StaticNode key={index} node={child} />
        ),
      )}
    </>
  );
}

function content(block: BlockDiff, prefix: string, path: string): ReactNode {
  if (block.inline) return <InlineRuns parts={block.inline} />;
  if (block.children) return <DiffBlocks blocks={block.children} prefix={prefix} path={path} />;
  return null;
}

export interface DiffBlockProps {
  block: BlockDiff;
  prefix: string;
  /** Where this level sits: "0" at the top, "0.3" inside the fourth child of the first block. */
  path: string;
}

/** One block of any level, drawn as its own element carrying its op. */
export function DiffBlock({ block, prefix, path }: DiffBlockProps): ReactNode {
  const ids = moveIds(prefix, path, block);
  const childPath = `${path}.${block.newIndex ?? block.oldIndex ?? 0}`;
  switch (block.op) {
    case 'equal':
      return <StaticNode node={block.after!} />;
    case 'insert':
      return <StaticNode node={block.after!} extra={{ 'data-op': 'insert' }} />;
    case 'delete':
      return <StaticNode node={block.before!} extra={{ 'data-op': 'delete' }} />;
    case 'move_source':
      return blockShell(
        { type: block.type === 'listItem' || block.type === 'taskItem' ? 'listItem' : 'paragraph' },
        <MoveLink block={block} target={ids.destination} end="move_source" />,
        { 'data-op': 'move_source', id: ids.source },
      );
    case 'move':
    case 'change': {
      const extra: ShellProps = {
        'data-op': block.op,
        ...(block.op === 'move' ? { id: ids.destination } : {}),
      };
      const inner = content(block, prefix, childPath) ?? <InlineContentOf block={block} />;
      const link =
        block.op === 'move' && !TABLE_PARTS.has(block.type) ? (
          <span className="mt-1 flex">
            <MoveLink block={block} target={ids.source} end="move" />
          </span>
        ) : null;
      return blockShell(
        block.after ?? { type: block.type },
        link ? (
          <>
            {inner}
            {link}
          </>
        ) : (
          inner
        ),
        extra,
      );
    }
  }
}

/** A level of blocks in order. */
export function DiffBlocks({
  blocks,
  prefix,
  path,
}: {
  blocks: readonly BlockDiff[];
  prefix: string;
  path: string;
}) {
  return (
    <>
      {blocks.map((block, index) => (
        <DiffBlock
          key={`${block.op}-${block.oldIndex}-${block.newIndex}-${index}`}
          block={block}
          prefix={prefix}
          path={path}
        />
      ))}
    </>
  );
}
