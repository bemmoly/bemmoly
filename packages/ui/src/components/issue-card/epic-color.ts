/*
 * The epic palette: eight hues, one job. An epic stores its colour as one of these names
 * (`epic-1` … `epic-8`), so the swatch, the lane square, the rail bar and the card stripe are
 * the same colour on every screen and follow the theme. An epic saved before colours existed
 * takes a hue from its id, which is just as stable.
 */

export const EPIC_PALETTE = [
  'epic-1',
  'epic-2',
  'epic-3',
  'epic-4',
  'epic-5',
  'epic-6',
  'epic-7',
  'epic-8',
] as const;

export type EpicColor = (typeof EPIC_PALETTE)[number];

const FILLS: Record<EpicColor, string> = {
  'epic-1': 'bg-epic-1',
  'epic-2': 'bg-epic-2',
  'epic-3': 'bg-epic-3',
  'epic-4': 'bg-epic-4',
  'epic-5': 'bg-epic-5',
  'epic-6': 'bg-epic-6',
  'epic-7': 'bg-epic-7',
  'epic-8': 'bg-epic-8',
};

const STRIPES: Record<EpicColor, string> = {
  'epic-1': 'border-l-epic-1',
  'epic-2': 'border-l-epic-2',
  'epic-3': 'border-l-epic-3',
  'epic-4': 'border-l-epic-4',
  'epic-5': 'border-l-epic-5',
  'epic-6': 'border-l-epic-6',
  'epic-7': 'border-l-epic-7',
  'epic-8': 'border-l-epic-8',
};

const isEpicColor = (value: string): value is EpicColor =>
  (EPIC_PALETTE as readonly string[]).includes(value);

/** A stable hue for an epic with no stored colour, from its id. */
export function epicColorFromId(id: string): EpicColor {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return EPIC_PALETTE[hash % EPIC_PALETTE.length] ?? 'epic-1';
}

/** The epic's colour: the stored one when it is a palette name, else the one its id gives. */
export function epicColor(stored: string | null | undefined, id: string): EpicColor {
  return stored && isEpicColor(stored) ? stored : epicColorFromId(id);
}

/** The background utility for an epic colour; muted ink for "no epic". */
export const epicFill = (color: EpicColor | null): string =>
  color === null ? 'bg-tx-3' : FILLS[color];

/** The left-border utility for an epic colour, for the Board's "by epic" card stripe. */
export const epicStripe = (color: EpicColor | null): string =>
  color === null ? 'border-l-tx-3' : STRIPES[color];
