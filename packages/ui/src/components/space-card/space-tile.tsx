import { cx } from '../../lib/cx.ts';

/**
 * A space's colour. The Docs mock paints each space tile a solid colour with white initials;
 * these are the solid tokens closest to the mock's six (accent, violet, teal, rust, rose,
 * slate), so they hold in every preset and in dark mode.
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

const TONE_CLASSES: Record<SpaceTone, string> = {
  accent: 'bg-ac-fill text-on-ac',
  violet: 'bg-violet text-on-solid',
  green: 'bg-ok text-on-solid',
  orange: 'bg-warn text-on-solid',
  red: 'bg-danger text-on-solid',
  amber: 'bg-caution text-on-solid',
  slate: 'bg-tx4 text-sf',
};

/** A stored colour if it names a tone, else a stable tone from the space key. */
export function spaceTone(key: string, color?: string | null): SpaceTone {
  if (color && (SPACE_TONES as readonly string[]).includes(color)) return color as SpaceTone;
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SPACE_TONES[hash % SPACE_TONES.length] as SpaceTone;
}

/** "Company handbook" → "CH"; "Engineering" → "EN". */
export function spaceInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`
      : (words[0] ?? '').slice(0, 2);
  return letters.toUpperCase();
}

export type SpaceTileSize = 'sm' | 'md';

/** md: the Docs home cards (34px, 13px). sm: the space sidebar header (30px, 12px). */
const SIZES: Record<SpaceTileSize, string> = {
  md: 'size-8.5 text-13',
  sm: 'size-7.5 text-12',
};

export interface SpaceTileProps {
  name: string;
  tone: SpaceTone;
  size?: SpaceTileSize;
  className?: string;
}

/** The space's square: 7px radius, semibold initials on the space colour. */
export function SpaceTile({ name, tone, size = 'md', className }: SpaceTileProps) {
  return (
    <span
      aria-hidden
      className={cx(
        'flex shrink-0 items-center justify-center rounded-panel font-semibold',
        TONE_CLASSES[tone],
        SIZES[size],
        className,
      )}
    >
      {spaceInitials(name)}
    </span>
  );
}
