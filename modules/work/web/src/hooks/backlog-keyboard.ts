import { useCallback, useEffect, type KeyboardEvent } from 'react';
import type { DropTarget } from '../backlog/move.ts';
import { revealRow } from './backlog-scroll.ts';
import { draggedIds } from './backlog-selection.ts';
import { initialTarget, screenOrder, stepTarget, type ContainerLayout } from './backlog-slots.ts';
import { useBacklogUi } from './backlog-store.ts';

export interface RowKeyOptions {
  /** The layout as it is when the key is pressed. */
  layout: () => readonly ContainerLayout[];
  onDrop: (ids: readonly string[], target: DropTarget) => void;
  onOpen: (id: string) => void;
}

/**
 * The rows' keyboard at rest: arrows move focus (shift extends the
 * selection), space picks the row up with the rest of the selection when it
 * is selected, Enter opens it and Escape clears the selection.
 */
export function useRowKeys({ layout, onOpen }: RowKeyOptions) {
  return useCallback(
    (event: KeyboardEvent<HTMLElement>, id: string) => {
      const ui = useBacklogUi.getState();
      if (ui.drag) return;
      const current = layout();
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      if (event.key === ' ') {
        event.preventDefault();
        const order = screenOrder(current);
        const picked = draggedIds(ui.selection, id).sort(
          (a, b) => order.indexOf(a) - order.indexOf(b),
        );
        if (!ui.selection.ids.includes(id)) ui.setSelection({ ids: [id], anchor: id });
        ui.startDrag(picked, 'keyboard', initialTarget(current, picked));
      } else if (step !== 0) {
        event.preventDefault();
        const order = screenOrder(current);
        const next = order[order.indexOf(id) + step];
        if (!next) return;
        if (event.shiftKey) ui.select(next, { shift: true }, order);
        revealRow(current, next);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        onOpen(id);
      } else if (event.key === 'Escape' && ui.selection.ids.length > 0) {
        event.preventDefault();
        ui.setSelection({ ids: [], anchor: null });
      }
    },
    [layout, onOpen],
  );
}

/**
 * While rows are picked up with the keyboard, keys belong to the move
 * wherever focus is, since scrolling can unmount the row that had it:
 * arrows move the drop place, space or Enter drops, Escape cancels.
 */
export function useKeyboardMove({ layout, onDrop }: RowKeyOptions) {
  const active = useBacklogUi((state) => state.drag?.mode === 'keyboard');
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event: globalThis.KeyboardEvent) => {
      const ui = useBacklogUi.getState();
      const drag = ui.drag;
      if (!drag) return;
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      if (step === 0 && ![' ', 'Enter', 'Escape', 'Tab'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const current = layout();
      if (step !== 0 && drag.target) {
        const target = stepTarget(current, new Set(drag.ids), drag.target, step);
        ui.setTarget(target);
        if (target.beforeId) revealRow(current, target.beforeId, false);
        return;
      }
      ui.endDrag();
      const first = drag.ids[0];
      if ((event.key === ' ' || event.key === 'Enter') && drag.target) {
        onDrop(drag.ids, drag.target);
      }
      if (first) requestAnimationFrame(() => revealRow(layout(), first));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, layout, onDrop]);
}
