import { IssueCard, type EpicColor } from '@bemmoly/ui';
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  startTransition,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { useBoardDragStore } from '../hooks/board-drag-store.ts';
import type { ViewCard } from '../hooks/board-model.ts';
import { useIssuePending } from '../hooks/issue-edits.ts';
import { clearBoardSelection, useBoardSelectionStore } from '../hooks/board-selection.ts';
import { openRowMenu, ROW_MENU } from '../shared/issue-actions-menu.tsx';
import { useSearchParamIs } from '../shared/url-state.ts';
import { CardTools } from './card-tools.tsx';
import { cardProps } from './card-view.ts';
import { cls, FOCUS_RING, useBoardShared } from './board-context.ts';
import { settle, takeLanding } from './landing.ts';

export interface BoardCardProps {
  card: ViewCard;
  laneId: string;
  columnId: string;
  /**
   * Where in its cell the card just set down landed. Only that card is told: it settles there
   * and keeps the focus, and the cards the drop shifted up or down have no reason to render.
   */
  landing?: number;
  laneColor: EpicColor | null;
}

const NONE: readonly string[] = [];

/**
 * Carried by the pointer, the card left behind is a faded, slightly smaller slot while the
 * browser's ghost follows the mouse; carried by the keyboard it is the card that moves, so it
 * lifts off the board instead. A dropped card settles where it lands.
 */
const CARRIED = {
  pointer: 'opacity-40 motion-safe:scale-[0.98]',
  keyboard: 'shadow-e2 motion-safe:-translate-y-0.5',
} as const;

interface CardFaceProps {
  card: ViewCard;
  laneColor: EpicColor | null;
  carried: 'pointer' | 'keyboard' | null;
  selected: boolean;
  checked: boolean;
  /** Draws the hover tools and the selection box; off until the card is first reached. */
  tools: boolean;
}

/**
 * What the card shows, apart from where it sits: it renders only when the card, its look or its
 * tools change, never because a drop moved the cards around it up or down a place.
 */
const CardFace = memo(function CardFace({
  card,
  laneColor,
  carried,
  selected,
  checked,
  tools,
}: CardFaceProps) {
  const { vocab, select, density } = useBoardShared();
  const selecting = useBoardSelectionStore((state) => state.selection.ids.length > 0);
  // Only a checked card follows the whole selection, so its menu can act on all of it.
  const targets = useBoardSelectionStore((state) => (checked ? state.selection.ids : NONE));
  const props = useMemo(() => cardProps(card, vocab, laneColor), [card, vocab, laneColor]);
  const pending = useIssuePending(card.key);
  const boxed = tools || checked || selecting;
  return (
    <IssueCard
      {...props}
      interactive={carried === null}
      selected={selected}
      pending={pending}
      checked={checked}
      selecting={selecting}
      density={density}
      {...(boxed
        ? { onCheck: (event: MouseEvent<HTMLElement>) => select.check(event, card.key) }
        : {})}
      tools={
        tools && carried === null && <CardTools card={card} {...(checked ? { targets } : {})} />
      }
    />
  );
});

/**
 * One draggable, focusable card. The design system's card draws it; this wrapper carries the
 * pointer and keyboard handling and the "carried" look, and skips rendering unless its own
 * card, place or carried state changed. Its tools (two tooltipped buttons and a menu) are drawn
 * the first time the pointer or the focus reaches the card, so a board of hundreds of cards
 * mounts, and redraws, only what anyone can see.
 */
export const BoardCard = memo(function BoardCard({
  card,
  laneId,
  columnId,
  landing,
  laneColor,
}: BoardCardProps) {
  const { actions, vocab, instructionsId, quick, select, touch } = useBoardShared();
  const carried = useBoardDragStore((state) =>
    state.carrying?.issueId === card.issueId ? state.carrying.mode : null,
  );
  const checked = useBoardSelectionStore((state) => state.selection.ids.includes(card.key));
  const open = useSearchParamIs('issue', card.key);
  const [reached, setReached] = useState(false);
  // Low priority: a card the pointer crosses mid-drag, or lands under it, never holds up a frame.
  const reach = reached ? undefined : () => startTransition(() => setReached(true));
  const ruleColor = vocab.ruleColor(card);
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (useBoardDragStore.getState().takeFocus(card.issueId)) element.current?.focus();
  }, [card.issueId, laneId, columnId, landing]);
  useLayoutEffect(() => {
    if (
      landing !== undefined &&
      element.current &&
      takeLanding(card.issueId, { laneId, columnId, index: landing })
    )
      settle(element.current);
  }, [card.issueId, laneId, columnId, landing]);
  return (
    <div
      ref={element}
      data-issue-id={card.issueId}
      role="button"
      tabIndex={0}
      aria-roledescription="draggable card"
      aria-label={`${card.key} ${card.title}${checked ? ', selected' : ''}`}
      aria-describedby={instructionsId}
      aria-pressed={carried !== null}
      draggable
      onPointerEnter={reach}
      onFocus={reach}
      onClick={(event) => {
        if (!select.click(event, card.key)) actions.open(card.key);
      }}
      onMouseDown={(event) => {
        // Shift-click would otherwise select the text between this card and the anchor.
        if (event.shiftKey) event.preventDefault();
      }}
      data-issue-key={card.key}
      onContextMenu={(event) => {
        // The menu key on a card the pointer never reached: draw the tools, then open the menu.
        if (!event.currentTarget.querySelector(`[${ROW_MENU}]`)) flushSync(() => setReached(true));
        openRowMenu(event);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const plain = !event.metaKey && !event.ctrlKey && !event.altKey;
        if (carried === null && select.keyDown(event, card.key)) return;
        if (plain && carried === null && event.key === 'i' && vocab.meId) {
          event.preventDefault();
          void quick.update(select.targets(card.key), { assigneeId: vocab.meId });
          return;
        }
        if (plain && carried === null && (event.key === 'Delete' || event.key === 'Backspace')) {
          event.preventDefault();
          const keys = select.targets(card.key);
          quick.remove(keys);
          if (keys.length > 1) clearBoardSelection();
          return;
        }
        actions.keyDown(event, card.issueId);
      }}
      onDragStart={(event) => actions.dragStart(event, card.issueId)}
      onDragEnd={actions.dragEnd}
      onDragOver={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        actions.dragOverCard(event, card.issueId, event.clientY > box.top + box.height / 2);
      }}
      style={ruleColor ? ({ '--card-rule': ruleColor } as CSSProperties) : undefined}
      className={cls(
        'cursor-grab rounded-control active:cursor-grabbing',
        'motion-safe:transition-[opacity,scale,translate,box-shadow] data-settle:motion-safe:animate-settle',
        FOCUS_RING,
        carried && CARRIED[carried],
      )}
    >
      <CardFace
        card={card}
        laneColor={laneColor}
        carried={carried}
        selected={carried !== null || open}
        checked={checked}
        tools={reached || touch}
      />
    </div>
  );
});
