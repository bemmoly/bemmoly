import type { ElementType, ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';
import { Avatar, type AvatarHue } from '../avatar/avatar.tsx';
import { Checkbox } from '../checkbox/checkbox.tsx';
import { StatusGlyph } from '../glyphs/status-glyph.tsx';
import { TypeGlyph, type IssueTypeRef } from '../glyphs/glyphs.tsx';
import { KeyChip } from '../key-chip/key-chip.tsx';
import { STATUS_LABELS, type StatusCategory } from '../status-badge/status-badge.tsx';

export interface RowStatus {
  category: StatusCategory;
  label?: ReactNode;
}

/** The status at the end of a row: the glyph and the status's name, as list rows show it. */
function RowStatusMark({ status }: { status: RowStatus }) {
  const name = status.label ?? STATUS_LABELS[status.category];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-12 text-tx-2">
      <StatusGlyph
        stage={status.category}
        size={13}
        {...(typeof name === 'string' ? { label: name } : {})}
      />
      <span className="hidden max-w-28 truncate sm:inline">{name}</span>
    </span>
  );
}

const ROW =
  'group/row flex min-h-9 items-center gap-2.5 border-b border-line-2 px-3 text-13 text-tx';

/** Secondary actions at the end of a row: shown on hover and focus, always on touch screens. */
function RowActions({ children }: { children: ReactNode }) {
  return (
    <span className="flex shrink-0 items-center opacity-100 transition-opacity duration-(--duration-base) pointer-fine:opacity-0 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:group-hover/row:opacity-100">
      {children}
    </span>
  );
}

export interface SubtaskRowProps {
  issueKey: string;
  title: ReactNode;
  type?: IssueTypeRef;
  status: RowStatus;
  done?: boolean;
  assignee?: { name: string; initials?: string; hue?: AvatarHue };
  href?: string;
  /** A remove or more button, revealed on hover and focus. */
  actions?: ReactNode;
  className?: string;
}

/**
 * A sub-issue on the Issue page: a 36px list row with the type tile, the key, the title (struck
 * through in tx-3 when done), the avatar and the status glyph with its name.
 */
export function SubtaskRow({
  issueKey,
  title,
  type = 'task',
  status,
  done = false,
  assignee,
  href,
  actions,
  className,
}: SubtaskRowProps) {
  const Tag: ElementType = href ? 'a' : 'span';
  return (
    <div className={cx(ROW, href && 'hover:bg-hover', className)}>
      <Tag
        href={href}
        className={cx(
          'flex min-w-0 flex-1 items-center gap-2.5 self-stretch rounded-xs text-tx no-underline',
          href && focusRingInset,
        )}
      >
        <TypeGlyph type={type} />
        <KeyChip issueKey={issueKey} />
        <span className={cx('min-w-0 flex-1 truncate', done && 'text-tx-3 line-through')}>
          {title}
        </span>
      </Tag>
      {assignee && (
        <Avatar
          name={assignee.name}
          hue={assignee.hue}
          {...(assignee.initials ? { initials: assignee.initials } : {})}
        />
      )}
      <RowStatusMark status={status} />
      {actions && <RowActions>{actions}</RowActions>}
    </div>
  );
}

export interface LinkedIssueRowProps {
  issueKey: string;
  title: ReactNode;
  type: IssueTypeRef;
  status: RowStatus;
  href: string;
  /** Remove the link, revealed on hover and focus. */
  actions?: ReactNode;
  className?: string;
}

/** A linked issue under its group label: the same row as a sub-issue. */
export function LinkedIssueRow({
  issueKey,
  title,
  type,
  status,
  href,
  actions,
  className,
}: LinkedIssueRowProps) {
  return (
    <div className={cx(ROW, 'hover:bg-hover', className)}>
      <a
        href={href}
        className={cx(
          'flex min-w-0 flex-1 items-center gap-2.5 self-stretch rounded-xs text-tx no-underline',
          focusRingInset,
        )}
      >
        <TypeGlyph type={type} />
        <KeyChip issueKey={issueKey} />
        <span className="min-w-0 flex-1 truncate">{title}</span>
      </a>
      <RowStatusMark status={status} />
      {actions && <RowActions>{actions}</RowActions>}
    </div>
  );
}

export interface CriteriaRowProps {
  children: ReactNode;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Edit and remove, revealed on hover and focus. */
  actions?: ReactNode;
  className?: string;
}

/**
 * One acceptance criterion: the 16px checkbox and its text, struck through in tx-3 once met.
 * The text is the checkbox's label, so a click anywhere on it ticks the criterion.
 */
export function CriteriaRow({
  children,
  checked,
  onCheckedChange,
  disabled,
  actions,
  className,
}: CriteriaRowProps) {
  return (
    <div
      className={cx(
        'group/row flex min-h-8 items-center gap-2 rounded-panel px-1.5 hover:bg-hover',
        className,
      )}
    >
      <label
        className={cx(
          'flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1.5 text-13 text-tx',
          disabled && 'cursor-not-allowed',
        )}
      >
        <Checkbox
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange?.(event.target.checked)}
        />
        <span className={cx('min-w-0 flex-1', checked && 'text-tx-3 line-through')}>
          {children}
        </span>
      </label>
      {actions && <RowActions>{actions}</RowActions>}
    </div>
  );
}
