import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { Avatar, type AvatarHue, type AvatarSize } from './avatar.tsx';

export interface StackPerson {
  id: string;
  name: string;
  initials?: string;
  hue?: AvatarHue;
}

export interface AvatarStackProps {
  people: readonly StackPerson[];
  size?: AvatarSize;
  /** People shown before the "+N" chip. */
  max?: number;
  /** Total when only a page of people is loaded; the chip shows total minus shown. */
  total?: number;
  /** Ring colour: the surface the stack sits on (Team cards use sf, the board filter bg). */
  ring?: 'sf' | 'bg';
  /** Makes each avatar a toggle, as the Board filter does; selected ones get an accent ring. */
  selected?: readonly string[];
  onToggle?: (id: string) => void;
  /** Names the stack, e.g. "Filter by assignee". */
  label?: string;
  className?: string;
}

/** Overlapping avatars, -6px each, with a 2px ring; the Board filter adds a 1px page halo. */
export function AvatarStack({
  people,
  size = 26,
  max = 5,
  total,
  ring = 'sf',
  selected,
  onToggle,
  label,
  className,
}: AvatarStackProps) {
  const shown = people.slice(0, max);
  const extra = (total ?? people.length) - shown.length;
  const interactive = Boolean(onToggle);
  const halo = ring === 'bg' ? 'shadow-halo' : '';
  return (
    <div
      role={interactive ? 'group' : undefined}
      aria-label={label}
      className={cx('flex pl-1.5', className)}
    >
      {shown.map((person) => {
        const on = selected?.includes(person.id) ?? false;
        const avatar = (
          <Avatar
            name={person.name}
            hue={person.hue}
            size={size}
            ring={on ? 'ac' : 'sf'}
            className={halo}
            {...(person.initials ? { initials: person.initials } : {})}
          />
        );
        if (!interactive) {
          return (
            <span key={person.id} className="-ml-1.5 inline-flex">
              {avatar}
            </span>
          );
        }
        return (
          <button
            key={person.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle?.(person.id)}
            className={cx(
              '-ml-1.5 inline-flex cursor-pointer rounded-full border-0 bg-transparent p-0',
              focusRing,
            )}
          >
            {avatar}
          </button>
        );
      })}
      {extra > 0 && (
        <span
          style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
          className={cx(
            '-ml-1.5 inline-flex shrink-0 items-center justify-center rounded-full border-2 bg-line-2 font-semibold text-tx-2',
            ring === 'bg' ? 'border-sunken' : 'border-card',
          )}
          aria-label={`${extra} more`}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
