/**
 * The page tree works on the rows it shows: a flat list in reading order, each row carrying
 * its depth and parent. Everything here is pure, so drag, keyboard moves and focus movement
 * are tested without a DOM.
 */

export interface PageTreeItem {
  id: string;
  parentId: string | null;
  /** 0 for a root page. */
  depth: number;
  title: string;
  /** An emoji the page carries. */
  icon?: string | null;
  hasChildren: boolean;
  /** Its children are shown below it. */
  expanded?: boolean;
  /** Its children are being fetched. */
  loading?: boolean;
}

/** Where a page goes: under `parentId`, between `afterId` and `beforeId` (null for an end). */
export interface PageTreeMove {
  id: string;
  parentId: string | null;
  afterId: string | null;
  beforeId: string | null;
}

/** Above a row, into it as its last child, or below it. */
export type DropZone = 'before' | 'inside' | 'after';

export type KeyboardMove = 'up' | 'down' | 'indent' | 'outdent';

/** The rows that share `parentId`, in order. */
export function siblingsOf(items: readonly PageTreeItem[], parentId: string | null) {
  return items.filter((item) => item.parentId === parentId);
}

/** Visible children of a row; empty while it is collapsed. */
export function childrenOf(items: readonly PageTreeItem[], id: string) {
  const parent = items.find((item) => item.id === id);
  return parent?.expanded ? siblingsOf(items, id) : [];
}

/** True when `id` is `ancestorId` or sits anywhere below it. */
export function isWithin(items: readonly PageTreeItem[], ancestorId: string, id: string): boolean {
  const byId = new Map(items.map((item) => [item.id, item]));
  let current: string | null = id;
  while (current) {
    if (current === ancestorId) return true;
    current = byId.get(current)?.parentId ?? null;
  }
  return false;
}

/** The pointer's place over a row: the top and bottom quarters are between rows. */
export function zoneAt(offsetY: number, height: number): DropZone {
  if (offsetY < height * 0.25) return 'before';
  if (offsetY > height * 0.75) return 'after';
  return 'inside';
}

function neighbours(siblings: readonly PageTreeItem[], index: number) {
  return {
    above: index > 0 ? (siblings[index - 1]?.id ?? null) : null,
    below: siblings[index + 1]?.id ?? null,
  };
}

/** Whether a move would leave the page where it is. */
function isNoop(items: readonly PageTreeItem[], move: PageTreeMove): boolean {
  const page = items.find((item) => item.id === move.id);
  if (!page || page.parentId !== move.parentId) return false;
  const siblings = siblingsOf(items, move.parentId);
  const { above, below } = neighbours(siblings, siblings.indexOf(page));
  if (move.afterId === null && move.beforeId === null) return below === null;
  return (
    (move.afterId === null || move.afterId === above) &&
    (move.beforeId === null || move.beforeId === below)
  );
}

/**
 * The move a drop makes, or null when the drop is refused: onto itself, into its own
 * subtree, or to where it already is. Dropping below an open page that has children puts
 * the page first among them, where the line is drawn.
 */
export function moveForDrop(
  items: readonly PageTreeItem[],
  dragId: string,
  overId: string,
  zone: DropZone,
): PageTreeMove | null {
  const over = items.find((item) => item.id === overId);
  if (!over || isWithin(items, dragId, overId)) return null;
  const others = items.filter((item) => item.id !== dragId);
  let move: PageTreeMove;
  if (zone === 'inside') {
    const kids = childrenOf(others, overId);
    move = { id: dragId, parentId: overId, afterId: kids.at(-1)?.id ?? null, beforeId: null };
  } else if (zone === 'after' && over.expanded && childrenOf(others, overId).length > 0) {
    const first = childrenOf(others, overId)[0];
    move = { id: dragId, parentId: overId, afterId: null, beforeId: first?.id ?? null };
  } else {
    const siblings = siblingsOf(others, over.parentId);
    const index = siblings.findIndex((item) => item.id === overId);
    const { above, below } = neighbours(siblings, index);
    move =
      zone === 'before'
        ? { id: dragId, parentId: over.parentId, afterId: above, beforeId: overId }
        : { id: dragId, parentId: over.parentId, afterId: overId, beforeId: below };
  }
  return isNoop(items, move) ? null : move;
}

/**
 * The keyboard alternative to dragging. Alt+↑/↓ swaps with the sibling above or below,
 * Alt+→ makes the page the last child of the sibling above, Alt+← puts it right after its
 * parent. Null when there is nowhere to go.
 */
export function moveForKey(
  items: readonly PageTreeItem[],
  id: string,
  direction: KeyboardMove,
): PageTreeMove | null {
  const page = items.find((item) => item.id === id);
  if (!page) return null;
  const siblings = siblingsOf(items, page.parentId);
  const index = siblings.indexOf(page);
  const others = siblings.filter((item) => item.id !== id);
  if (direction === 'up') {
    const target = siblings[index - 1];
    if (!target) return null;
    const at = others.indexOf(target);
    return {
      id,
      parentId: page.parentId,
      afterId: others[at - 1]?.id ?? null,
      beforeId: target.id,
    };
  }
  if (direction === 'down') {
    const target = siblings[index + 1];
    if (!target) return null;
    const at = others.indexOf(target);
    return {
      id,
      parentId: page.parentId,
      afterId: target.id,
      beforeId: others[at + 1]?.id ?? null,
    };
  }
  if (direction === 'indent') {
    const target = siblings[index - 1];
    if (!target) return null;
    const kids = childrenOf(items, target.id);
    return { id, parentId: target.id, afterId: kids.at(-1)?.id ?? null, beforeId: null };
  }
  const parent = items.find((item) => item.id === page.parentId);
  if (!parent) return null;
  const outer = siblingsOf(items, parent.parentId);
  const below = outer[outer.indexOf(parent) + 1]?.id ?? null;
  return { id, parentId: parent.parentId, afterId: parent.id, beforeId: below };
}

/**
 * Where focus goes for a tree key, following the WAI-ARIA tree pattern: ↑ ↓ walk the shown
 * rows, → opens a closed row or steps into an open one, ← closes an open row or steps out
 * to the parent, Home and End jump to the ends. `toggle` asks the owner to open or close.
 */
export function focusForKey(
  items: readonly PageTreeItem[],
  id: string,
  key: string,
): { focus?: string; toggle?: boolean } | null {
  const index = items.findIndex((item) => item.id === id);
  const item = items[index];
  if (!item) return null;
  switch (key) {
    case 'ArrowDown':
      return items[index + 1] ? { focus: items[index + 1]?.id } : {};
    case 'ArrowUp':
      return index > 0 ? { focus: items[index - 1]?.id } : {};
    case 'Home':
      return { focus: items[0]?.id };
    case 'End':
      return { focus: items.at(-1)?.id };
    case 'ArrowRight':
      if (!item.hasChildren) return {};
      if (!item.expanded) return { toggle: true };
      return items[index + 1]?.parentId === id ? { focus: items[index + 1]?.id } : {};
    case 'ArrowLeft':
      if (item.expanded && item.hasChildren) return { toggle: false };
      return item.parentId ? { focus: item.parentId } : {};
    default:
      return null;
  }
}

/** The next row after `id` whose title starts with `letter`, wrapping round: typeahead. */
export function rowForLetter(
  items: readonly PageTreeItem[],
  id: string,
  letter: string,
): string | null {
  const start = items.findIndex((item) => item.id === id);
  const wanted = letter.toLowerCase();
  for (let step = 1; step <= items.length; step += 1) {
    const item = items[(start + step) % items.length];
    if (item && (item.title || 'Untitled').toLowerCase().startsWith(wanted)) return item.id;
  }
  return null;
}
