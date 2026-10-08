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
  /** "commented", "changed status In progress → In review", "logged 4h". */
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
          size === 'page' ? 'text-13 leading-brief' : 'text-12h leading-body',
        )}
      >
        <div>
          <span className="font-semibold text-tx">{person.name}</span>{' '}
          <span className="text-tx5">
            {verb} · {when}
          </span>
        </div>
        {children && <div className="text-tx-body">{children}</div>}
        {reactions && <div className="flex flex-wrap gap-1 pt-0.5">{reactions}</div>}
        {actions && <div className="flex gap-2.5 text-12 text-tx4">{actions}</div>}
      </div>
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
        'cursor-pointer rounded-xs border-0 bg-transparent p-0 font-sans text-12 text-tx4 hover:text-tx2',
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
        'inline-flex cursor-pointer items-center gap-1 rounded-pill border px-1.75 py-0.5 font-sans text-11',
        reacted
          ? 'border-ac-br bg-ac-bg text-ac'
          : 'border-transparent bg-chip text-tx2 hover:bg-trk',
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
