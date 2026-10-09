import { cx } from '../../lib/cx.ts';

export type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';

/**
 * From the Board mock's `pris` table: glyph, name and colour. The mocks show four levels; the
 * fifth, Lowest, mirrors Highest's double arrow and sits in tx5 so the scale stays red to green.
 */
export const PRIORITIES: Record<Priority, { glyph: string; name: string; color: string }> = {
  highest: { glyph: '⇈', name: 'Highest', color: 'text-danger-hi' },
  high: { glyph: '↑', name: 'High', color: 'text-warn' },
  medium: { glyph: '=', name: 'Medium', color: 'text-caution' },
  low: { glyph: '↓', name: 'Low', color: 'text-ok' },
  lowest: { glyph: '⇊', name: 'Lowest', color: 'text-tx5' },
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

export type IssueType = 'story' | 'bug' | 'task' | 'epic' | 'incident' | 'subtask';

/**
 * From the Board mock's `types` table (story, bug, task) and the Workflow mock's `typeDefs`
 * (epic, incident, subtask): name, colour, corner radius and glyph.
 */
export const ISSUE_TYPES: Record<IssueType, { name: string; className: string; glyph: string }> = {
  story: { name: 'Story', className: 'bg-ok text-on-solid rounded-chip', glyph: '▮' },
  bug: { name: 'Bug', className: 'bg-danger text-on-solid rounded-full', glyph: '●' },
  task: { name: 'Task', className: 'bg-ac-fill text-on-ac rounded-chip', glyph: '✓' },
  epic: { name: 'Epic', className: 'bg-violet text-on-solid rounded-chip', glyph: '◆' },
  incident: { name: 'Incident', className: 'bg-warn text-on-solid rounded-full', glyph: '!' },
  subtask: { name: 'Subtask', className: 'bg-tx4 text-on-solid rounded-chip', glyph: '–' },
};

export type TypeGlyphSize = 14 | 16 | 18 | 36;

/** Tile and glyph sizes: cards and rows, ⌘K, the issue type list and the type page title. */
const TYPE_SIZES: Record<TypeGlyphSize, string> = {
  14: 'size-3.5 text-9',
  16: 'size-4 text-9',
  18: 'size-4.5 text-10',
  36: 'size-9 text-16',
};

export interface TypeGlyphProps {
  type: IssueType;
  /** 14px on cards and rows; 16px in the command palette; 18 and 36 in type settings. */
  size?: TypeGlyphSize;
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
        'inline-flex shrink-0 items-center justify-center leading-none font-semibold',
        TYPE_SIZES[size],
        t.className,
        className,
      )}
    >
      <span aria-hidden>{t.glyph}</span>
    </span>
  );
}
