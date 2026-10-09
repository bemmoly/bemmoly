import { KanbanCard } from '@bemmoly/ui';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useBoardDragStore } from '../hooks/board-drag-store.ts';
import type { ViewCard } from '../hooks/board-model.ts';
import { cardProps } from './card-view.ts';
import { cls, FOCUS_RING, useBoardShared } from './board-context.ts';
import { settle, takeLanding } from './landing.ts';

export interface BoardCardProps {
  card: ViewCard;
  laneId: string;
  columnId: string;
  /** Position among the cell's other cards, as a drop before this card would land. */
  index: number;
  laneHue: number | null;
}

/**
 * Carried by the pointer, the card left behind is a faded, slightly smaller slot while the
 * browser's ghost follows the mouse; carried by the keyboard it is the card that moves, so it
 * lifts off the board instead. A dropped card settles where it lands.
 */
const CARRIED = {
  pointer: 'opacity-40 motion-safe:scale-[0.98]',
  keyboard: 'shadow-menu motion-safe:-translate-y-0.5',
} as const;

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
  const carried = useBoardDragStore((state) =>
    state.carrying?.issueId === card.issueId ? state.carrying.mode : null,
  );
  const props = useMemo(() => cardProps(card, vocab, laneHue), [card, vocab, laneHue]);
  const ruleColor = vocab.ruleColor(card);
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (useBoardDragStore.getState().takeFocus(card.issueId)) element.current?.focus();
  }, [card.issueId, laneId, columnId, index]);
  useLayoutEffect(() => {
    if (element.current && takeLanding(card.issueId, { laneId, columnId, index }))
      settle(element.current);
  }, [card.issueId, laneId, columnId, index]);
  return (
    <div
      ref={element}
      data-issue-id={card.issueId}
      role="button"
      tabIndex={0}
      aria-roledescription="draggable card"
      aria-label={`${card.key} ${card.title}`}
      aria-describedby={instructionsId}
      aria-pressed={carried !== null}
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
        'motion-safe:transition-[opacity,scale,translate,box-shadow] data-settle:motion-safe:animate-settle',
        FOCUS_RING,
        carried && CARRIED[carried],
      )}
    >
      <KanbanCard
        {...props}
        interactive={carried === null}
        selected={carried !== null || selectedKey === card.key}
        dimmed={isDimmed?.(card.issueId) ?? false}
      />
    </div>
  );
});
