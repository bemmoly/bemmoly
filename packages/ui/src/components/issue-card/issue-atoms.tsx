import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
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
