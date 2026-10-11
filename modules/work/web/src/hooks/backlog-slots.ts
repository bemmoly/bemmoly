import type { DropTarget } from '../backlog/move.ts';

/*
 * The places a drop can land, top to bottom: above each visible row of an
 * open container and after its last row; a collapsed container is one place.
 * The keyboard walks this list; the pointer finds a place by hit-testing.
 */

export interface ContainerLayout {
  id: string;
  /** Rows on screen in this container, in order. */
  visibleIds: readonly string[];
  open: boolean;
}

export function slotsOf(
  layout: readonly ContainerLayout[],
  moving: ReadonlySet<string>,
): DropTarget[] {
  return layout.flatMap((container) => {
    const rows = container.open ? container.visibleIds.filter((id) => !moving.has(id)) : [];
    return [
      ...rows.map((id) => ({ containerId: container.id, beforeId: id })),
      { containerId: container.id, beforeId: null },
    ];
  });
}

/** Where picked-up rows sit now: above the row after the last of them, in their container. */
export function initialTarget(
  layout: readonly ContainerLayout[],
  ids: readonly string[],
): DropTarget | null {
  const moving = new Set(ids);
  const home = layout.find((container) => container.visibleIds.some((id) => moving.has(id)));
  if (!home) return null;
  const lastIndex = home.visibleIds.reduce(
    (last, id, index) => (moving.has(id) ? index : last),
    -1,
  );
  const next = home.visibleIds.slice(lastIndex + 1).find((id) => !moving.has(id)) ?? null;
  return { containerId: home.id, beforeId: next };
}

/** One place up (-1) or down (+1), stopping at the ends. */
export function stepTarget(
  layout: readonly ContainerLayout[],
  moving: ReadonlySet<string>,
  current: DropTarget,
  delta: number,
): DropTarget {
  const slots = slotsOf(layout, moving);
  const at = slots.findIndex(
    (slot) => slot.containerId === current.containerId && slot.beforeId === current.beforeId,
  );
  if (at < 0) return slots[0] ?? current;
  return slots[Math.max(0, Math.min(slots.length - 1, at + delta))] ?? current;
}

/** The visible row after `id` in its container, skipping moving rows, or null at the end. */
export function rowAfter(
  layout: readonly ContainerLayout[],
  containerId: string,
  id: string,
): string | null {
  const rows = layout.find((container) => container.id === containerId)?.visibleIds ?? [];
  return rows[rows.indexOf(id) + 1] ?? null;
}

/** Every visible row id in screen order, for shift ranges and arrow focus. */
export function screenOrder(layout: readonly ContainerLayout[]): string[] {
  return layout.flatMap((container) => (container.open ? container.visibleIds : []));
}
