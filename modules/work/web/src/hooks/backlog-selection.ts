/*
 * Multi-select over the Backlog's rows, as file lists do it: a click picks
 * one row, cmd or ctrl toggles a row, shift extends from the anchor over the
 * rows as the screen orders them, across sprints and the backlog.
 */

export interface Selection {
  /** Selected ids; order carries no meaning, drops use screen order. */
  ids: readonly string[];
  /** Where a shift-click range starts. */
  anchor: string | null;
}

export const EMPTY_SELECTION: Selection = { ids: [], anchor: null };

export interface SelectModifiers {
  shift?: boolean;
  /** Cmd on macOS, Ctrl elsewhere. */
  toggle?: boolean;
}

function range(order: readonly string[], from: string, to: string): string[] {
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a < 0 || b < 0) return [to];
  return order.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/** The selection after a click on `id`, given the visible rows in screen order. */
export function nextSelection(
  current: Selection,
  id: string,
  modifiers: SelectModifiers,
  order: readonly string[],
): Selection {
  if (modifiers.shift && current.anchor) {
    const span = range(order, current.anchor, id);
    const ids = modifiers.toggle ? [...new Set([...current.ids, ...span])] : span;
    return { ids, anchor: current.anchor };
  }
  if (modifiers.toggle) {
    const ids = current.ids.includes(id)
      ? current.ids.filter((selected) => selected !== id)
      : [...current.ids, id];
    return { ids, anchor: id };
  }
  return { ids: [id], anchor: id };
}

/** What a drag or a keyboard pick-up carries: the selection if the row is in it, else the row. */
export function draggedIds(selection: Selection, id: string): string[] {
  return selection.ids.includes(id) ? [...selection.ids] : [id];
}

/** Drops ids no longer on screen, e.g. after a filter or a live update removed them. */
export function pruneSelection(selection: Selection, visible: ReadonlySet<string>): Selection {
  const ids = selection.ids.filter((id) => visible.has(id));
  if (ids.length === selection.ids.length) return selection;
  const anchor = selection.anchor && visible.has(selection.anchor) ? selection.anchor : null;
  return { ids, anchor };
}
