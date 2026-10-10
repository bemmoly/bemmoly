import type { Editor } from '@tiptap/core';

/** Clear of the selection and of the viewport's edges. */
const GAP = 8;

/**
 * Puts a fixed popover above the selection, centred on it when it sits on one line and at its
 * start when it wraps; below it only when there is no room above. Layout size is read rather
 * than the box, which is scaled while it pops in.
 */
export function placeOver(editor: Editor, el: HTMLElement): void {
  const { from, to } = editor.state.selection;
  const view = editor.view;
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  const sameLine = Math.abs(start.top - end.top) < 4;
  const centre = sameLine ? (start.left + end.right) / 2 : start.left + width / 2;
  const above = start.top - height - GAP;
  const viewport = view.dom.ownerDocument.documentElement;
  const right = (viewport.clientWidth || window.innerWidth) - width - GAP;
  el.style.top = `${above < GAP ? end.bottom + GAP : above}px`;
  el.style.left = `${Math.max(GAP, Math.min(centre - width / 2, right))}px`;
  el.style.visibility = 'visible';
}
