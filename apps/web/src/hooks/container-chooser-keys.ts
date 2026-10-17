import type { KeyboardEvent } from 'react';
import type { ContainerChooser } from './use-container-chooser.ts';

/** PageUp and PageDown move by the rows the list shows at once. */
export const PAGE_ROWS = 9;

/**
 * The list's keys: arrows, Home, End and the page keys move; Shift with an arrow extends;
 * Space ticks (Shift+Space ticks the range from the anchor); Mod+A ticks all shown; Mod+Z
 * undoes a clear while its Undo is offered. No single letters, so typing never collides.
 */
export function chooserKeyDown(event: KeyboardEvent, chooser: ContainerChooser) {
  const mod = event.metaKey || event.ctrlKey;
  const { active } = chooser;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (event.altKey) return;
  if (mod) {
    if (key === 'a') chooser.selectAll();
    else if (key !== 'z' || !chooser.undo()) return;
  } else if (key === 'ArrowDown' || key === 'ArrowUp') {
    chooser.moveTo(active + (key === 'ArrowDown' ? 1 : -1), event.shiftKey);
  } else if (key === 'Home') chooser.moveTo(0);
  else if (key === 'End') chooser.moveTo(chooser.count - 1);
  else if (key === 'PageDown') chooser.moveTo(active + PAGE_ROWS);
  else if (key === 'PageUp') chooser.moveTo(active - PAGE_ROWS);
  else if (key === ' ') chooser.toggle(active, event.shiftKey);
  else return;
  event.preventDefault();
  event.stopPropagation();
}
