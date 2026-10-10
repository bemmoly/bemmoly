import { cx } from '../../lib/cx.ts';

/**
 * A space's colour. The Docs mock paints each space tile a solid colour with white initials:
 * accent, violet, teal, rust, rose and slate. They come from the entity palette (the epic
 * hues), never the signal reds and ambers, so a space never reads as a warning (ADR 0015). The
 * stored names stay as they were, so existing spaces keep their choice.
 */
export const SPACE_TONES = [
  'accent',
  'violet',
  'green',
  'orange',
  'red',
  'amber',
  'slate',
] as const;
export type SpaceTone = (typeof SPACE_TONES)[number];

/** Each tone's entity palette hue; accent follows the theme, slate is the ink. */
export const SPACE_TONE_HUES = {
  accent: 'accent',
  violet: 'epic-2',
  green: 'epic-3',
  orange: 'epic-4',
  red: 'epic-6',
  amber: 'epic-7',
  slate: 'ink',
} as const satisfies Record<SpaceTone, string>;

const TONE_CLASSES: Record<SpaceTone, string> = {
  accent: 'bg-acc-fill text-on-acc',
  violet: 'bg-epic-2 text-on-solid',
  green: 'bg-epic-3 text-on-solid',
  orange: 'bg-epic-4 text-on-solid',
  red: 'bg-epic-6 text-on-solid',
  amber: 'bg-epic-7 text-on-solid',
  slate: 'bg-tx text-canvas',
};

/** A stored colour if it names a tone, else a stable tone from the space key. */
export function spaceTone(key: string, color?: string | null): SpaceTone {
  if (color && (SPACE_TONES as readonly string[]).includes(color)) return color as SpaceTone;
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SPACE_TONES[hash % SPACE_TONES.length] as SpaceTone;
}

/**
 * The tile's two letters: the first two of the space key when there is one ("ENG" → "EN",
 * "DS" → "DS"), as the mock's tiles read; else from the name ("Company handbook" → "CH").
 */
export function spaceInitials(name: string, spaceKey?: string): string {
  if (spaceKey) return spaceKey.slice(0, 2).toUpperCase();
  const words = name.split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`
      : (words[0] ?? '').slice(0, 2);
  return letters.toUpperCase();
}

export type SpaceTileSize = 'xs' | 'sm' | 'md';

/**
 * md: the Docs home cards (34px, 13px). sm: the space sidebar header (30px, 12px). xs: a
 * space in a menu or a picker row (20px, 9.5px), the avatar size of the same lists.
 */
const SIZES: Record<SpaceTileSize, string> = {
  md: 'size-8.5 rounded-panel text-13',
  sm: 'size-7.5 rounded-panel text-12',
  xs: 'size-5 rounded-xs text-9h',
};

export interface SpaceTileProps {
  name: string;
  /** The space key, which the initials come from when given. */
  spaceKey?: string;
  tone: SpaceTone;
  size?: SpaceTileSize;
  className?: string;
}

/** The space's square: 7px radius, semibold initials on the space colour. */
export function SpaceTile({ name, spaceKey, tone, size = 'md', className }: SpaceTileProps) {
  return (
    <span
      aria-hidden
      className={cx(
        'flex shrink-0 items-center justify-center font-semibold',
        TONE_CLASSES[tone],
        SIZES[size],
        className,
      )}
    >
      {spaceInitials(name, spaceKey)}
    </span>
  );
}
