import type { CSSProperties } from 'react';
import { Icon, type IconName } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { EPIC_COLORS } from '../../tokens/semantic.ts';

/**
 * ink: the workspace (the ink colour, canvas letters). accent: the theme accent. work, docs, ai:
 * the module colours, which are the logo's three colours. A hex is a colour stored on the thing
 * (a team's colour); without either, the tile takes a stable hue from the epic palette.
 */
export type EntityTone = 'ink' | 'accent' | 'work' | 'docs' | 'ai';

const TONES: Record<EntityTone, string> = {
  ink: 'bg-tx text-canvas',
  accent: 'bg-acc-fill text-on-acc',
  work: 'bg-brand-1 text-on-solid',
  docs: 'bg-brand-2 text-on-solid',
  ai: 'bg-brand-3 text-on-solid',
};

const PALETTE = Object.keys(EPIC_COLORS) as (keyof typeof EPIC_COLORS)[];

/** Spelled out so Tailwind sees every class. */
const HUES: Record<keyof typeof EPIC_COLORS, string> = {
  'epic-1': 'bg-epic-1',
  'epic-2': 'bg-epic-2',
  'epic-3': 'bg-epic-3',
  'epic-4': 'bg-epic-4',
  'epic-5': 'bg-epic-5',
  'epic-6': 'bg-epic-6',
  'epic-7': 'bg-epic-7',
  'epic-8': 'bg-epic-8',
};

export type EntityHue = keyof typeof EPIC_COLORS;

/** A stable palette colour for a name, so a project keeps its hue across screens. */
export function entityHue(seed: string): keyof typeof EPIC_COLORS {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length] as keyof typeof EPIC_COLORS;
}

export interface EntityTileProps {
  /** What the tile stands for: its accessible name and, without a letter or icon, its initial. */
  name: string;
  /** Overrides the initial (two letters for a module abbreviation, say). */
  letter?: string;
  /** An icon in place of a letter (a module's icon). */
  icon?: IconName;
  tone?: EntityTone;
  /** A palette hue chosen for the thing (a space's stored colour); wins over the tone. */
  hue?: EntityHue;
  /** A stored hex colour; wins over the tone. */
  color?: string | null;
  /** An uploaded logo, drawn in the same rounded square. */
  src?: string | null;
  /** Width and height in px. */
  size?: number;
  /** Hidden from assistive tech when a visible name sits beside it (the default). */
  decorative?: boolean;
  className?: string;
}

/**
 * One tile for a workspace, a project, a module or a team: a square at the logo's corner
 * ratio (26% of its size) with a letter at 52% or an icon at 62%, white on its colour
 * (docs/design/premium/kit.js, `pt` and `mt`).
 */
export function EntityTile({
  name,
  letter,
  icon,
  tone,
  hue,
  color,
  src,
  size = 18,
  decorative = true,
  className,
}: EntityTileProps) {
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name };
  const box: CSSProperties = { width: size, height: size, borderRadius: size * 0.26 };
  if (src) {
    return (
      <img
        src={src}
        alt={decorative ? '' : name}
        style={box}
        className={cx('shrink-0 object-cover', className)}
      />
    );
  }
  const fill =
    hue || (!tone && !color) ? `${HUES[hue ?? entityHue(name)]} text-on-solid` : undefined;
  return (
    <span
      {...a11y}
      style={{ ...box, fontSize: Math.round(size * 0.52), ...(color ? { background: color } : {}) }}
      className={cx(
        'inline-grid shrink-0 place-items-center leading-none font-semibold',
        color ? 'text-on-solid' : (fill ?? TONES[tone ?? 'accent']),
        className,
      )}
    >
      {icon ? (
        <Icon name={icon} size={Math.round(size * 0.62)} />
      ) : (
        (letter ?? name.trim().charAt(0)).toUpperCase()
      )}
    </span>
  );
}
