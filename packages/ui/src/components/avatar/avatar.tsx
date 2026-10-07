import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/cx.ts';
import { HUES, type Hue } from '../../tokens/names.ts';

/** Accent is the current user (RS in the mocks); grey is someone without a colour yet (SR). */
export type AvatarHue = Hue | 'accent' | 'grey';

const HUE_CLASSES: Record<AvatarHue, string> = {
  accent: 'bg-ac-av text-ac',
  grey: 'bg-chip text-tx3',
  green: 'bg-green-bg text-green-fg',
  orange: 'bg-orange-bg text-orange-fg',
  violet: 'bg-violet-bg text-violet-fg',
  pink: 'bg-pink-bg text-pink-fg',
  amber: 'bg-amber-bg text-amber-fg',
  sky: 'bg-sky-bg text-sky-fg',
};

export type AvatarSize = 20 | 22 | 24 | 26 | 28 | 30;

/** Diameter and initials size pairs used across the mocks. */
const SIZES: Record<AvatarSize, string> = {
  20: 'size-5 text-9h',
  22: 'size-5.5 text-10',
  24: 'size-6 text-9h',
  26: 'size-6.5 text-10',
  28: 'size-7 text-10h',
  30: 'size-7.5 text-11',
};

/** A stable colour for a person, so the same name always gets the same hue. */
export function avatarHue(key: string): Hue {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[hash % HUES.length] as Hue;
}

/** "Rohan Sharma" -> "RS"; "rohan@acme.dev" -> "RO". */
export function initialsOf(name: string): string {
  const words = name
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters =
    words.length > 1
      ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`
      : (words[0] ?? '').slice(0, 2);
  return letters.toUpperCase();
}

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  /** Two letters; derived from the name when omitted. */
  initials?: string;
  hue?: AvatarHue;
  size?: AvatarSize;
  /** 12px initials at 30px, as the top bar user avatar has. */
  prominent?: boolean;
  /** A 2px ring in the given surface colour, used when avatars overlap. */
  ring?: 'sf' | 'bg' | 'ac';
}

const RINGS = {
  sf: 'border-2 border-sf',
  bg: 'border-2 border-bg',
  ac: 'border-2 border-ac',
} as const;

export function Avatar({
  name,
  initials,
  hue,
  size = 22,
  prominent,
  ring,
  className,
  ...rest
}: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full leading-none font-semibold',
        prominent && size === 30 ? 'size-7.5 text-12' : SIZES[size],
        HUE_CLASSES[hue ?? avatarHue(name)],
        ring && RINGS[ring],
        className,
      )}
      {...rest}
    >
      <span aria-hidden>{initials ?? initialsOf(name)}</span>
    </span>
  );
}
