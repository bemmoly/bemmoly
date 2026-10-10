import { proseClass } from '@bemmoly/editor';
import type { BlockDiff, DocDiff } from '@bemmoly/module-docs/shared';
import { EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useId, useState } from 'react';
import { cx } from '../comments/cx.ts';
import { attrSummary, DiffBlock } from './diff-blocks.tsx';
import { blockName } from './diff-node.tsx';

/*
 * The compare's reading column: the page as it is in the newer version, with every change
 * marked where it happened. Top-level blocks get a 3px gutter bar in their op's colour;
 * nested ones (list items, rows, cells) are tinted in place. Long unchanged stretches fold
 * to one line, keeping a block of context on each side.
 */

/** Unchanged blocks kept on each side of a change before the rest fold away. */
const CONTEXT = 1;
/** Fold only stretches longer than this. */
const FOLD_OVER = 3;

/** Colours by op, on every element that carries one, at any depth. */
const OP_STYLES = cx(
  '[&_[data-op=insert]]:bg-green-50/70',
  '[&_[data-op=delete]]:bg-red/8 [&_[data-op=delete]]:text-tx-3 [&_[data-op=delete]]:line-through [&_[data-op=delete]]:decoration-red/50',
  '[&_[data-op=move]]:bg-violet-bg/40',
  '[&_[data-op=move_source]]:rounded-chip [&_[data-op=move_source]]:border [&_[data-op=move_source]]:border-dashed [&_[data-op=move_source]]:border-violet-fg/40 [&_[data-op=move_source]]:px-2 [&_[data-op=move_source]]:py-1',
  // The place a list item left is not a list item any more: it takes no number.
  '[&_li[data-op=move_source]]:block',
  '[&_td[data-op=change]]:bg-amber-bg/60 [&_th[data-op=change]]:bg-amber-bg/60',
  '[&_[data-flash]]:ring-2 [&_[data-flash]]:ring-acc [&_[data-flash]]:ring-offset-2 [&_[data-flash]]:ring-offset-card',
);

const BARS: Record<BlockDiff['op'], string> = {
  equal: 'before:bg-transparent',
  insert: 'before:bg-green',
  delete: 'before:bg-red',
  change: 'before:bg-amber',
  move: 'before:bg-epic-2',
  move_source: 'before:bg-epic-2/40',
};

const OP_WORDS: Record<BlockDiff['op'], string> = {
  equal: 'Unchanged',
  insert: 'Added',
  delete: 'Removed',
  change: 'Edited',
  move: 'Moved',
  move_source: 'Moved away',
};

type Row =
  | { kind: 'block'; block: BlockDiff; index: number }
  | { kind: 'fold'; blocks: { block: BlockDiff; index: number }[] };

/** Blocks in order, with long unchanged stretches folded. */
export function foldRows(blocks: readonly BlockDiff[]): Row[] {
  const rows: Row[] = [];
  let run: { block: BlockDiff; index: number }[] = [];
  const flush = (atStart: boolean, atEnd: boolean) => {
    const keepHead = atStart ? 0 : CONTEXT;
    const keepTail = atEnd ? 0 : CONTEXT;
    const folded = run.length - keepHead - keepTail;
    if (run.length > FOLD_OVER && folded > 1) {
      run.slice(0, keepHead).forEach((entry) => rows.push({ kind: 'block', ...entry }));
      rows.push({ kind: 'fold', blocks: run.slice(keepHead, run.length - keepTail) });
      run.slice(run.length - keepTail).forEach((entry) => rows.push({ kind: 'block', ...entry }));
    } else run.forEach((entry) => rows.push({ kind: 'block', ...entry }));
    run = [];
  };
  blocks.forEach((block, index) => {
    if (block.op === 'equal') {
      run.push({ block, index });
      return;
    }
    flush(rows.length === 0, false);
    rows.push({ kind: 'block', block, index });
  });
  flush(rows.length === 0, true);
  return rows;
}

function TopBlock({ block, prefix }: { block: BlockDiff; prefix: string }) {
  const attrs = attrSummary(block);
  return (
    <div
      data-diff-row={block.op}
      className={cx(
        'relative pl-4 before:absolute before:inset-y-0.5 before:left-0 before:w-0.75 before:rounded-full',
        BARS[block.op],
      )}
    >
      {block.op !== 'equal' && (
        <span className="sr-only">
          {OP_WORDS[block.op]} {blockName(block.type).toLowerCase()}:
        </span>
      )}
      {attrs && (
        <span className="mb-1 inline-flex rounded-chip bg-amber-bg px-1.5 py-px font-sans text-11 font-medium text-amber-fg">
          {blockName(block.type)} · {attrs}
        </span>
      )}
      <DiffBlock block={block} prefix={prefix} path="0" />
    </div>
  );
}

export function DiffView({ diff, className }: { diff: DocDiff; className?: string }) {
  const prefix = useId().replace(/:/g, '');
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const { inserted, deleted, changed, moved } = diff.stats;
  if (diff.blocks.length === 0 || inserted + deleted + changed + moved === 0) {
    return (
      <EmptyState
        title="No changes"
        description="These two versions read the same, word for word."
        className={className}
      />
    );
  }
  const rows = foldRows(diff.blocks);
  return (
    <div className={cx(proseClass('page'), OP_STYLES, 'gap-2.5! text-tx', className)}>
      {rows.map((row, index) => {
        if (row.kind === 'block')
          return <TopBlock key={row.index} block={row.block} prefix={prefix} />;
        const first = row.blocks[0]!.index;
        if (open.has(first)) {
          return row.blocks.map((entry) => (
            <TopBlock key={entry.index} block={entry.block} prefix={prefix} />
          ));
        }
        return (
          <button
            key={`fold-${index}`}
            type="button"
            onClick={() => setOpen(new Set([...open, first]))}
            className="flex h-7.5 cursor-pointer items-center gap-2 rounded-[7px] border-0 bg-sunken px-2.5 font-sans text-[12.5px] text-tx-3 hover:text-tx-2 focus-ring"
          >
            <Icon name="caret" size={13} />
            {row.blocks.length} unchanged {row.blocks.length === 1 ? 'block' : 'blocks'}
          </button>
        );
      })}
    </div>
  );
}
