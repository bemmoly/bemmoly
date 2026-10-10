/** The epic palette's swatch classes, epic-1 to epic-8 (ADR 0015). */
export const EPIC_SWATCHES = [
  'bg-epic-1',
  'bg-epic-2',
  'bg-epic-3',
  'bg-epic-4',
  'bg-epic-5',
  'bg-epic-6',
  'bg-epic-7',
  'bg-epic-8',
] as const;

/** A stored colour in the palette's own words: "epic-3". */
const PALETTE_NAME = /^epic-([1-8])$/;

/**
 * An epic's swatch. The colour stored on the epic wins when it names a palette hue; otherwise
 * the epic's id picks one, so the same epic has the same colour on every screen and after a
 * reload, whatever order a list shows it in.
 */
export function epicSwatch(epicId: string, stored?: string | null): string {
  const named = stored ? PALETTE_NAME.exec(stored) : null;
  if (named) return EPIC_SWATCHES[Number(named[1]) - 1] ?? 'bg-epic-1';
  let hash = 0;
  for (const char of epicId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return EPIC_SWATCHES[hash % EPIC_SWATCHES.length] ?? 'bg-epic-1';
}
