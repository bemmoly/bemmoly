import { KanbanCell } from '@bemmoly/ui';
import { Fragment, memo, useEffect, useRef, type ReactNode } from 'react';
import { useBoardDragStore } from '../hooks/board-drag-store.ts';
import type { ViewCard } from '../hooks/board-model.ts';
import { cellId, useBoardWindowStore, useCellLimit } from '../hooks/board-window.ts';
import { BoardCard } from './board-card.tsx';
import { cls, useBoardShared } from './board-context.ts';

export interface BoardCellProps {
  laneId: string;
  laneLabel: string;
  columnId: string;
  columnName: string;
  cards: readonly ViewCard[];
  laneHue: number | null;
}

/** The 2px accent line where a carried card would land. */
function DropLine() {
  return <div aria-hidden className="-my-1.25 h-0.5 shrink-0 rounded-full bg-ac" />;
}

/** Grows the window when the end of a long cell scrolls into view. */
function MoreSentinel({ cell }: { cell: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          useBoardWindowStore.getState().grow(cell);
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cell]);
  return <div ref={ref} aria-hidden className="h-px shrink-0" />;
}

/**
 * One column of one lane: the drop area. While a card from this lane is carried it shows where
 * the card would land, or, when the workflow refuses this column, the reason in the warn pair.
 */
export const BoardCell = memo(function BoardCell({
  laneId,
  laneLabel,
  columnId,
  columnName,
  cards,
  laneHue,
}: BoardCellProps) {
  const { actions } = useBoardShared();
  const cell = cellId(laneId, columnId);
  const limit = useCellLimit(cell);
  const carriedId = useBoardDragStore((state) =>
    state.carrying?.from.laneId === laneId ? state.carrying.issueId : null,
  );
  const line = useBoardDragStore((state) =>
    state.target?.laneId === laneId && state.target.columnId === columnId
      ? state.target.index
      : null,
  );
  const verdict = useBoardDragStore((state) =>
    state.carrying?.from.laneId === laneId ? state.verdicts?.[columnId] : undefined,
  );
  const refused = verdict !== undefined && !verdict.allowed;
  const shown = cards.slice(0, limit);
  const items: ReactNode[] = [];
  let others = 0;
  for (const [index, card] of shown.entries()) {
    const carried = card.issueId === carriedId;
    items.push(
      <Fragment key={card.issueId}>
        {!refused && !carried && line === others && <DropLine />}
        <BoardCard
          card={card}
          laneId={laneId}
          columnId={columnId}
          index={index}
          laneHue={laneHue}
        />
      </Fragment>,
    );
    if (!carried) others += 1;
  }
  return (
    <KanbanCell
      label={`${columnName}, ${laneLabel}`}
      dropping={line !== null && !refused}
      onDragOver={(event) => {
        if (event.target === event.currentTarget)
          actions.dragOver(event, { laneId, columnId, index: cards.length });
      }}
      onDrop={actions.dropHere}
      className={cls(refused && line !== null && 'border border-dashed border-warn bg-warn-bg')}
    >
      {/* Not a drop target of its own: under the pointer it would turn the drop into a cancel,
          and the refusal would go unsaid. */}
      {refused && line !== null && (
        <p className="pointer-events-none m-0 px-2 py-1.5 text-11 font-medium text-warn-fg">
          {verdict.reason}
        </p>
      )}
      {items}
      {!refused && line !== null && line >= others && shown.length === cards.length && <DropLine />}
      {cards.length > limit && <MoreSentinel cell={cell} />}
    </KanbanCell>
  );
});
