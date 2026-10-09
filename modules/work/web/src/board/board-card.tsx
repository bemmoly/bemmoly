import { KanbanCard } from '@bemmoly/ui';
import { memo, useMemo, type CSSProperties } from 'react';
import { useBoardDragStore } from '../hooks/board-drag-store.ts';
import type { ViewCard } from '../hooks/board-model.ts';
import { cardProps } from './card-view.ts';
import { cls, FOCUS_RING, useBoardShared } from './board-context.ts';

export interface BoardCardProps {
  card: ViewCard;
  laneId: string;
  columnId: string;
  /** Position among the cell's other cards, as a drop before this card would land. */
  index: number;
  laneHue: number | null;
}

/**
 * One draggable, focusable card. The design system's card draws it; this wrapper carries the
 * pointer and keyboard handling and the "carried" look, and skips rendering unless its own
 * card, place or carried state changed.
 */
export const BoardCard = memo(function BoardCard({
  card,
  laneId,
  columnId,
  index,
  laneHue,
}: BoardCardProps) {
  const { actions, vocab, isDimmed, selectedKey, instructionsId } = useBoardShared();
  const carried = useBoardDragStore((state) => state.carrying?.issueId === card.issueId);
  const props = useMemo(() => cardProps(card, vocab, laneHue), [card, vocab, laneHue]);
  const ruleColor = vocab.ruleColor(card);
  return (
    <div
      data-issue-id={card.issueId}
      role="button"
      tabIndex={0}
      aria-roledescription="draggable card"
      aria-label={`${card.key} ${card.title}`}
      aria-describedby={instructionsId}
      aria-pressed={carried}
      draggable
      onClick={() => actions.open(card.key)}
      onKeyDown={(event) => actions.keyDown(event, card.issueId)}
      onDragStart={(event) => actions.dragStart(event, card.issueId)}
      onDragEnd={actions.dragEnd}
      onDragOver={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const below = event.clientY > box.top + box.height / 2;
        actions.dragOver(event, { laneId, columnId, index: index + (below ? 1 : 0) });
      }}
      style={ruleColor ? ({ '--card-rule': ruleColor } as CSSProperties) : undefined}
      className={cls(
        'cursor-grab rounded-control active:cursor-grabbing',
        FOCUS_RING,
        carried && 'opacity-60',
      )}
    >
      <KanbanCard
        {...props}
        selected={carried || selectedKey === card.key}
        dimmed={isDimmed?.(card.issueId) ?? false}
      />
    </div>
  );
});
