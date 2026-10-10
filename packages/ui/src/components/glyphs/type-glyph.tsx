import { createElement } from 'react';
import { iconComponent } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { typeLook, type IssueTypeRef, type TypeMark } from './type-look.ts';

/** Any pixel size; 14 on cards and rows, 16 in menus and the palette, 18 and 36 in settings. */
export type TypeGlyphSize = number;

export interface TypeGlyphProps {
  /** A built-in key ("story") or the stored type, whose icon and colour are drawn. */
  type: IssueTypeRef;
  size?: TypeGlyphSize;
  className?: string;
}

const WHITE = 'var(--on-solid)';

/** The review's bug: a body, legs and a head, in white. Coordinates are in tile pixels. */
function BugMark({ s }: { s: number }) {
  return (
    <g transform={`translate(${s / 2} ${s / 2})`} fill={WHITE}>
      <ellipse rx={s * 0.19} ry={s * 0.23} cy={s * 0.03} />
      <path
        d={`M${-s * 0.3} ${-s * 0.05}h${s * 0.6}M${-s * 0.28} ${s * 0.18}l${s * 0.1} ${-s * 0.04}M${s * 0.28} ${s * 0.18}l${-s * 0.1} ${-s * 0.04}`}
        stroke={WHITE}
        strokeWidth={s * 0.075}
        strokeLinecap="round"
      />
      <circle r={s * 0.1} cy={-s * 0.22} />
    </g>
  );
}

/** An exclamation mark, the incident's alarm, drawn like the urgent priority's. */
function AlertMark({ s }: { s: number }) {
  return (
    <g>
      <path
        d={`M${s / 2} ${s * 0.27}v${s * 0.29}`}
        stroke={WHITE}
        strokeWidth={s * 0.12}
        strokeLinecap="round"
      />
      <circle cx={s / 2} cy={s * 0.72} r={s * 0.07} fill={WHITE} />
    </g>
  );
}

function Mark({ mark, s }: { mark: TypeMark; s: number }) {
  if ('drawn' in mark) return mark.drawn === 'bug' ? <BugMark s={s} /> : <AlertMark s={s} />;
  const offset = s * 0.19;
  // The icon is a nested <svg> placed inside the tile, in the tile's coordinates.
  return createElement(iconComponent(mark.icon), {
    x: offset,
    y: offset,
    size: s * 0.62,
    color: WHITE,
    fill: mark.filled ? WHITE : 'none',
    strokeWidth: mark.filled ? 1.5 : 3.4,
    'aria-hidden': true,
  });
}

/**
 * An issue type as an SVG tile: the type's colour with the logo's ~24% corner ratio and a
 * white mark drawn inside, never a font character (docs/design/premium/kit.js, `ty`).
 */
export function TypeGlyph({ type, size = 14, className }: TypeGlyphProps) {
  const look = typeLook(type);
  return (
    <svg
      role="img"
      aria-label={look.name}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cx('inline-block shrink-0', className)}
    >
      <title>{look.name}</title>
      <rect
        width={size}
        height={size}
        rx={(size * 0.24).toFixed(1)}
        fill={`var(--${look.color})`}
      />
      <Mark mark={look.mark} s={size} />
    </svg>
  );
}
