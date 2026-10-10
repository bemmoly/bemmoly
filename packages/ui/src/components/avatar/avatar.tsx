import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/cx.ts';
import { HUES, type Hue } from '../../tokens/names.ts';

/** Accent is the signed-in person; grey is someone without a colour yet. */
export type AvatarHue = Hue | 'accent' | 'grey';

/** Solid mid-tone fills with white initials, readable at 16px and on light or dark. */
const FILLS: Record<AvatarHue, string> = {
  accent: 'bg-acc-fill text-on-acc',
  grey: 'bg-tx-3 text-on-solid',
  green: 'bg-avatar-green text-on-solid',
  orange: 'bg-avatar-orange text-on-solid',
  violet: 'bg-avatar-violet text-on-solid',
  pink: 'bg-avatar-pink text-on-solid',
  amber: 'bg-avatar-amber text-on-solid',
  sky: 'bg-avatar-sky text-on-solid',
};

/** Any diameter in px; the review uses 16 to 30. */
export type AvatarSize = number;

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
  /** A 2px ring in the given surface colour, used when avatars overlap. */
  ring?: 'sf' | 'bg' | 'ac';
}

const RINGS = {
  sf: 'border-2 border-card',
  bg: 'border-2 border-sunken',
  ac: 'border-2 border-acc',
} as const;

/**
 * A person as a solid circle with white initials at 42% of its size
 * (docs/design/premium/kit.js, `av`).
 */
export function Avatar({
  name,
  initials,
  hue,
  size = 22,
  ring,
  className,
  style,
  ...rest
}: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), ...style }}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full leading-none font-semibold tracking-[.01em]',
        FILLS[hue ?? avatarHue(name)],
        ring && RINGS[ring],
        className,
      )}
      {...rest}
    >
      <span aria-hidden>{initials ?? initialsOf(name)}</span>
    </span>
  );
}

export interface UnassignedAvatarProps {
  size?: AvatarSize;
  /** What assistive tech hears; "Unassigned" by default. */
  label?: string;
  className?: string;
}

/** Nobody yet: a dashed ring in the muted ink, the size of an avatar beside it. */
export function UnassignedAvatar({
  size = 22,
  label = 'Unassigned',
  className,
}: UnassignedAvatarProps) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={cx(
        'inline-block shrink-0 rounded-full border-[1.5px] border-dashed border-tx-3 opacity-60',
        className,
      )}
    />
  );
}
