import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { Avatar, type AvatarHue } from '../avatar/avatar.tsx';

export interface ActivityPerson {
  name: string;
  initials?: string;
  hue?: AvatarHue;
}

export interface ActivityItemProps {
  person: ActivityPerson;
  /** "commented", "changed status from In progress to In review", "logged 4h". */
  verb: ReactNode;
  /** "3 hours ago", "Thursday". */
  when: ReactNode;
  /** The comment body in tx-body; history and work log entries have none. */
  children?: ReactNode;
  /** Reply, React, Create issue from this: 12px tx4 actions 10px apart. */
  actions?: ReactNode;
  /** ReactionChips under a comment. */
  reactions?: ReactNode;
  /** page: the Issue page (13px at 1.55). panel: the drawer (12.5px at 1.5). */
  size?: 'page' | 'panel';
  className?: string;
}

/**
 * One activity entry: the 28px avatar, then the name in semibold with the verb and time in tx5,
 * the body and the actions 4px apart. History and work log rows are the same entry without a
 * body.
 */
export function ActivityItem({
  person,
  verb,
  when,
  children,
  actions,
  reactions,
  size = 'page',
  className,
}: ActivityItemProps) {
  return (
    <article className={cx('flex gap-2.5', className)}>
      <Avatar
        name={person.name}
        hue={person.hue}
        size={28}
        {...(person.initials ? { initials: person.initials } : {})}
      />
      <div
        className={cx(
          'flex min-w-0 flex-1 flex-col gap-1',
          size === 'page' ? 'text-13 leading-brief' : 'text-13 leading-body',
        )}
      >
        <div>
          <span className="font-semibold text-tx">{person.name}</span>{' '}
          <span className="text-tx-3">
            {verb} · {when}
          </span>
        </div>
        {children && <div className="text-tx">{children}</div>}
        {reactions && <div className="flex flex-wrap gap-1 pt-0.5">{reactions}</div>}
        {actions && <div className="flex gap-2.5 text-12 text-tx-3">{actions}</div>}
      </div>
    </article>
  );
}

export interface HistoryItemProps {
  person: ActivityPerson;
  /** The change, with status glyphs and names inline: "moved from (o) To do to (o) In progress". */
  children: ReactNode;
  /** A RelativeTime, right-aligned. */
  when: ReactNode;
  className?: string;
}

/**
 * A history or work log line: the 22px avatar, the name in medium weight, the change in tx-2
 * with its glyphs, and the time at the end in tx-3 (docs/design/premium/screens.js).
 */
export function HistoryItem({ person, children, when, className }: HistoryItemProps) {
  return (
    <article className={cx('flex items-start gap-2.5 text-13 leading-brief', className)}>
      <Avatar
        name={person.name}
        hue={person.hue}
        size={22}
        {...(person.initials ? { initials: person.initials } : {})}
      />
      <p className="m-0 min-w-0 flex-1 pt-px text-tx-2">
        <span className="font-medium text-tx">{person.name}</span> {children}
      </p>
      <span className="shrink-0 pt-px text-12 text-tx-3">{when}</span>
    </article>
  );
}

/** A borderless 12px tx4 action under a comment: Reply, React, Create issue from this. */
export function ActivityAction({
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cx(
        'cursor-pointer rounded-chip border-0 bg-transparent p-0 font-sans text-12 text-tx-3 hover:text-tx-2',
        focusRing,
        className,
      )}
      {...rest}
    />
  );
}

export interface ReactionChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onToggle'
> {
  emoji: string;
  count: number;
  /** The viewer has reacted: the accent tint and border, like a quick filter that is on. */
  reacted?: boolean;
  onToggle?: () => void;
}

/**
 * A reaction under a comment. No mock shows one; it is the quick filter pill at tag size: 11px,
 * 2px 7px, pill radius, chip or the accent tint when the viewer reacted.
 */
export function ReactionChip({
  emoji,
  count,
  reacted = false,
  onToggle,
  className,
  type = 'button',
  ...rest
}: ReactionChipProps) {
  return (
    <button
      type={type}
      aria-pressed={reacted}
      onClick={onToggle}
      className={cx(
        'inline-flex cursor-pointer items-center gap-1 rounded-full border px-1.75 py-0.5 font-sans text-11',
        reacted
          ? 'border-acc-100 bg-acc-50 text-acc'
          : 'border-transparent bg-line-2 text-tx-2 hover:bg-line',
        focusRing,
        className,
      )}
      {...rest}
    >
      <span aria-hidden>{emoji}</span>
      <span className="font-mono font-medium">{count}</span>
    </button>
  );
}
