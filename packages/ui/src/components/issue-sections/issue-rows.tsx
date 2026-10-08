import type { AnchorHTMLAttributes, ElementType, ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';
import { Avatar, type AvatarHue } from '../avatar/avatar.tsx';
import { Checkbox } from '../checkbox/checkbox.tsx';
import { TypeGlyph, type IssueType } from '../glyphs/glyphs.tsx';
import { KeyChip } from '../key-chip/key-chip.tsx';
import { StatusBadge, type StatusCategory } from '../status-badge/status-badge.tsx';

export interface RowStatus {
  category: StatusCategory;
  label?: ReactNode;
}

/** The status badge at the end of a row: 11px, 2px 7px, 3px radius, at least 70px wide. */
function RowStatusBadge({ status, wide }: { status: RowStatus; wide?: boolean }) {
  return (
    <StatusBadge
      category={status.category}
      label={status.label}
      size="sm"
      className={cx('px-1.75', wide && 'min-w-17.5 justify-center')}
    />
  );
}

export interface SubtaskRowProps {
  issueKey: string;
  title: ReactNode;
  type?: IssueType;
  status: RowStatus;
  done?: boolean;
  assignee?: { name: string; initials?: string; hue?: AvatarHue };
  href?: string;
  className?: string;
}

/**
 * A subtask on the Issue page: 9px 12px over a br-row rule (8px in the drawer), the type tile,
 * the key, the title (struck through in tx5 when done), the 22px avatar and the status.
 */
export function SubtaskRow({
  issueKey,
  title,
  type = 'task',
  status,
  done = false,
  assignee,
  href,
  className,
}: SubtaskRowProps) {
  const Tag: ElementType = href ? 'a' : 'div';
  return (
    <Tag
      href={href}
      className={cx(
        'flex items-center gap-2.5 border-b border-br-row px-3 py-2.25 text-13 text-tx no-underline',
        href && cx('hover:bg-bg2', focusRingInset),
        className,
      )}
    >
      <TypeGlyph type={type} />
      <KeyChip issueKey={issueKey} />
      <span className={cx('flex-1', done && 'text-tx5 line-through')}>{title}</span>
      {assignee && (
        <Avatar
          name={assignee.name}
          hue={assignee.hue}
          {...(assignee.initials ? { initials: assignee.initials } : {})}
        />
      )}
      <RowStatusBadge status={status} wide />
    </Tag>
  );
}

export interface LinkedIssueRowProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'title'
> {
  issueKey: string;
  title: ReactNode;
  type: IssueType;
  status: RowStatus;
}

/** A linked issue under its group label: the same row as a subtask, as a link. */
export function LinkedIssueRow({
  issueKey,
  title,
  type,
  status,
  className,
  ...rest
}: LinkedIssueRowProps) {
  return (
    <a
      className={cx(
        'flex items-center gap-2.5 border-b border-br-row px-3 py-2.25 text-13 text-tx no-underline hover:bg-bg2',
        focusRingInset,
        className,
      )}
      {...rest}
    >
      <TypeGlyph type={type} />
      <KeyChip issueKey={issueKey} />
      <span className="flex-1">{title}</span>
      <RowStatusBadge status={status} />
    </a>
  );
}

export interface CriteriaRowProps {
  children: ReactNode;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * One acceptance criterion as a checklist row. No mock shows the checklist form; it is built
 * from the subtask row and the Board Settings 16px checkbox, with the done text struck through.
 */
export function CriteriaRow({
  children,
  checked,
  onCheckedChange,
  disabled,
  className,
}: CriteriaRowProps) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-center gap-2.5 border-b border-br-row px-3 py-2.25 text-13 text-tx',
        disabled && 'cursor-not-allowed',
        className,
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
      />
      <span className={cx('flex-1', checked && 'text-tx5 line-through')}>{children}</span>
    </label>
  );
}
