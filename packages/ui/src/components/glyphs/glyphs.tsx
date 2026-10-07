import { cx } from '../../lib/cx.ts';

export type Priority = 'highest' | 'high' | 'medium' | 'low';

/** From the Board mock's `pris` table: glyph, name and colour. */
export const PRIORITIES: Record<Priority, { glyph: string; name: string; color: string }> = {
  highest: { glyph: '⇈', name: 'Highest', color: 'text-danger-hi' },
  high: { glyph: '↑', name: 'High', color: 'text-warn' },
  medium: { glyph: '=', name: 'Medium', color: 'text-caution' },
  low: { glyph: '↓', name: 'Low', color: 'text-ok' },
};

export interface PriorityGlyphProps {
  priority: Priority;
  /** Show the name beside the glyph, as in the drawer details. */
  showLabel?: boolean;
  className?: string;
}

/** Mono 12px semibold arrow; the name is always available to assistive tech. */
export function PriorityGlyph({ priority, showLabel, className }: PriorityGlyphProps) {
  const p = PRIORITIES[priority];
  const glyph = (
    <span
      role={showLabel ? undefined : 'img'}
      aria-label={showLabel ? undefined : `${p.name} priority`}
      aria-hidden={showLabel ? true : undefined}
      title={showLabel ? undefined : p.name}
      className={cx('font-mono text-12 font-semibold', p.color, !showLabel && className)}
    >
      {p.glyph}
    </span>
  );
  if (!showLabel) return glyph;
  return (
    <span className={cx('inline-flex items-center gap-1.5', className)}>
      {glyph}
      {p.name}
    </span>
  );
}

export type IssueType = 'story' | 'bug' | 'task';

/** From the Board mock's `types` table: name, colour, corner radius and glyph. */
export const ISSUE_TYPES: Record<IssueType, { name: string; className: string; glyph: string }> = {
  story: { name: 'Story', className: 'bg-ok text-on-solid rounded-chip', glyph: '▮' },
  bug: { name: 'Bug', className: 'bg-danger text-on-solid rounded-full', glyph: '●' },
  task: { name: 'Task', className: 'bg-ac-fill text-on-ac rounded-chip', glyph: '✓' },
};

export interface TypeGlyphProps {
  type: IssueType;
  /** 14px on cards and rows; 16px in the command palette. */
  size?: 14 | 16;
  className?: string;
}

export function TypeGlyph({ type, size = 14, className }: TypeGlyphProps) {
  const t = ISSUE_TYPES[type];
  return (
    <span
      role="img"
      aria-label={t.name}
      title={t.name}
      className={cx(
        'inline-flex shrink-0 items-center justify-center text-9 leading-none font-semibold',
        size === 14 ? 'size-3.5' : 'size-4',
        t.className,
        className,
      )}
    >
      <span aria-hidden>{t.glyph}</span>
    </span>
  );
}
