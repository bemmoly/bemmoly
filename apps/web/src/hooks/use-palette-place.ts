import { useState } from 'react';
import type { PaletteItem } from './command-items.ts';

export interface PalettePlace {
  /** The container's key the module's results carry ("ENG"). */
  key: string;
  /** What the chip says: "In Engineering". */
  label: string;
  /** The search kind the place applies to ("docs.page"); other kinds are left alone. */
  kind: string;
}

/**
 * The place the screen behind the palette is in. A module screen marks its root with
 * data-search-place (the key its search results carry), data-search-place-label and
 * data-search-place-kind, so the shell never needs to know what a space is.
 */
export function readPlace(root: ParentNode = document): PalettePlace | null {
  const marked = root.querySelector<HTMLElement>('[data-search-place]');
  const key = marked?.dataset['searchPlace'];
  const kind = marked?.dataset['searchPlaceKind'];
  if (!key || !kind) return null;
  return { key, kind, label: marked?.dataset['searchPlaceLabel'] || key };
}

/** Keeps results of the place's kind to the place; issues, people and settings stay. */
export function inPlace(items: readonly PaletteItem[], place: PalettePlace | null): PaletteItem[] {
  if (!place) return [...items];
  return items.filter(
    (item) =>
      !item.fromServer || !item.id.startsWith(`${place.kind}:`) || item.placeKey === place.key,
  );
}

/**
 * From inside a space, ⌘K starts "In Engineering"; Backspace in the empty field, or the chip's
 * ×, widens it to everything for the rest of this opening.
 */
export function usePalettePlace() {
  const [place, setPlace] = useState<PalettePlace | null>(() =>
    typeof document === 'undefined' ? null : readPlace(),
  );
  return { place, clear: () => setPlace(null) };
}
