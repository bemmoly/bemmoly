import { cx } from '../../lib/cx.ts';

/** The server's five levels. Highest is drawn as the review's Urgent. */
export type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';

/** How many of the three signal bars are inked; urgent is the red mark instead. */
type Level = 'urgent' | 3 | 2 | 1 | 0;

export const PRIORITIES: Record<Priority, { name: string; level: Level }> = {
  highest: { name: 'Highest', level: 'urgent' },
  high: { name: 'High', level: 3 },
  medium: { name: 'Medium', level: 2 },
  low: { name: 'Low', level: 1 },
  // The review stops at Low; Lowest keeps the three bars with none inked.
  lowest: { name: 'Lowest', level: 0 },
};

export interface PriorityGlyphProps {
  /** null draws "No priority": three dashes. */
  priority: Priority | null;
  /** Show the name beside the glyph, as in the drawer details. */
  showLabel?: boolean;
  size?: number;
  className?: string;
}

const BARS = [
  [2, 9, 4],
  [6.5, 6, 7],
  [11, 3, 10],
] as const;

function Drawing({ level }: { level: Level | null }) {
  if (level === 'urgent') {
    return (
      <>
        <rect x="1.5" y="1.5" width="13" height="13" rx="3.2" fill="var(--red)" />
        <path d="M8 4.6v4.2" stroke="var(--on-solid)" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="11.2" r="1.05" fill="var(--on-solid)" />
      </>
    );
  }
  if (level === null) {
    return (
      <path d="M3 8h2M7 8h2M11 8h2" stroke="var(--tx-3)" strokeWidth="1.6" strokeLinecap="round" />
    );
  }
  return BARS.map(([x, y, h], i) => (
    <rect
      key={x}
      x={x}
      y={y + 1}
      width="3"
      height={h}
      rx="1"
      fill={i < level ? 'var(--tx-2)' : 'var(--line)'}
    />
  ));
}

/**
 * Priority as neutral signal bars; only the most urgent level is coloured, so the red means
 * something (docs/design/premium/kit.js, `pr`). The name is always available to assistive tech.
 */
export function PriorityGlyph({ priority, showLabel, size = 16, className }: PriorityGlyphProps) {
  const p = priority ? PRIORITIES[priority] : null;
  const name = p ? `${p.name} priority` : 'No priority';
  const glyph = (
    <svg
      role={showLabel ? undefined : 'img'}
      aria-label={showLabel ? undefined : name}
      aria-hidden={showLabel ? true : undefined}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      overflow="visible"
      className={cx('inline-block shrink-0', !showLabel && className)}
    >
      {!showLabel && <title>{p?.name ?? 'No priority'}</title>}
      <Drawing level={p?.level ?? null} />
    </svg>
  );
  if (!showLabel) return glyph;
  return (
    <span className={cx('inline-flex items-center gap-1.5', className)}>
      {glyph}
      {p?.name ?? 'No priority'}
    </span>
  );
}
