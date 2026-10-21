import { Icon } from '../../icons/icon.tsx';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { AvatarStack } from '../avatar/avatar-stack.tsx';
import { Avatar, UnassignedAvatar, type AvatarHue } from '../avatar/avatar.tsx';

/*
 * The small parts the IssueCard and the IssueRow share, so both draw an issue the same way
 * (docs/design/premium/kit.css: `.pts`, `.chip.red`, `.av.none`).
 */

export interface CardPerson {
  name: string;
  initials?: string;
  hue?: AvatarHue;
}

/** Story points in the sunken pill: 18px tall, tabular figures. */
export function Points({ value, className }: { value: number | string; className?: string }) {
  return (
    <span
      aria-label={`${value} points`}
      className={cx(
        'inline-grid h-4.5 min-w-4.5 shrink-0 place-items-center rounded-full bg-sunken px-1.25 text-11 font-semibold text-tx-2 tabular-nums ring-1 ring-line ring-inset',
        className,
      )}
    >
      {value}
    </span>
  );
}

/** "Blocked by PLT-204": the small red chip with a lock, never a full-width banner. */
export function BlockedChip({ by, className }: { by: string; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-4.5 shrink-0 items-center gap-1 self-start rounded-chip bg-red-50 px-1.5 text-11 font-semibold whitespace-nowrap text-red-tx',
        className,
      )}
    >
      <Icon name="lock" size={11} />
      Blocked by {by}
    </span>
  );
}

export interface DateWarningChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** What is wrong, short: "Due after PLT-1". */
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Amber, beside the blocked chip: the issue's dates run past its epic's target. It is a button
 * because it opens the fixes (extend the epic, pull the issue in); a menu trigger spreads its
 * props on it.
 */
export function DateWarningChip({ children, className, ref, ...rest }: DateWarningChipProps) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      onClick={(event) => {
        // The chip sits on a card that opens on click; the chip's own menu must not open it.
        event.stopPropagation();
        rest.onClick?.(event);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        rest.onPointerDown?.(event);
      }}
      draggable={false}
      className={cx(
        'inline-flex h-4.5 shrink-0 cursor-pointer items-center gap-1 self-start rounded-chip border-0 bg-amber-50 px-1.5 font-sans text-11 font-semibold whitespace-nowrap text-amber-tx',
        focusRing,
        className,
      )}
    >
      <Icon name="warning" size={11} />
      {children}
    </button>
  );
}

/** At most this many faces on a card; the rest is the "+N" chip. */
const MAX_FACES = 3;

/**
 * The assignee, or the dashed ring when nobody is on it yet. With co-assignees it is one
 * overlapping stack, the assignee first, named as a whole for assistive tech.
 */
export function IssueAssignee({
  person,
  others,
  size = 20,
}: {
  person: CardPerson | null | undefined;
  others?: readonly CardPerson[] | undefined;
  size?: number;
}) {
  if (!person) return <UnassignedAvatar size={size} />;
  if (others && others.length > 0) {
    const everyone = [person, ...others];
    return (
      <AvatarStack
        size={size}
        max={MAX_FACES}
        label={`Assigned to ${everyone.map((one) => one.name).join(', ')}`}
        people={everyone.map((one, index) => ({
          id: `${index}:${one.name}`,
          name: one.name,
          ...(one.hue ? { hue: one.hue } : {}),
          ...(one.initials ? { initials: one.initials } : {}),
        }))}
      />
    );
  }
  return (
    <Avatar
      name={person.name}
      size={size}
      {...(person.hue ? { hue: person.hue } : {})}
      {...(person.initials ? { initials: person.initials } : {})}
    />
  );
}
