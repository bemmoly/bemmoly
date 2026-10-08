import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { Avatar, type AvatarHue } from '../avatar/avatar.tsx';

export interface FieldListProps extends HTMLAttributes<HTMLDListElement> {
  /** page: the Issue sidebar (6px 14px, rows 7px). panel: the drawer details (6px 12px, rows 6px). */
  size?: 'page' | 'panel';
}

/** The Details grid: a 110px label column, 2px row gap, 12.5px. */
export function FieldList({ size = 'page', className, ...rest }: FieldListProps) {
  return (
    <dl
      data-size={size}
      className={cx(
        'm-0 grid grid-cols-[110px_1fr] items-center gap-y-0.5 text-12h text-tx',
        size === 'page' ? 'px-3.5 py-1.5' : 'px-3 py-1.5',
        className,
      )}
      {...rest}
    />
  );
}

export interface FieldRowProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

/** One field: the label in tx4 and the value, both padded to the list's row height. */
export function FieldRow({ label, children, className }: FieldRowProps) {
  const pad = 'py-1.75 in-data-[size=panel]:py-1.5';
  return (
    <>
      <dt className={cx('text-tx4', pad)}>{label}</dt>
      <dd className={cx('m-0 flex min-w-0 flex-wrap items-center gap-1.5', pad, className)}>
        {children}
      </dd>
    </>
  );
}

export interface FieldPersonProps {
  name: string;
  initials?: string;
  hue?: AvatarHue;
  /** Hide the name and show only the 20px avatar, as the Reviewers row does. */
  avatarOnly?: boolean;
}

/** A person as a field value: the 20px avatar 7px before the name. */
export function FieldPerson({ name, initials, hue, avatarOnly }: FieldPersonProps) {
  return (
    <span className="inline-flex items-center gap-1.75">
      <Avatar name={name} hue={hue} size={20} {...(initials ? { initials } : {})} />
      {!avatarOnly && name}
    </span>
  );
}

/** The 9px colour square before an epic name in a field. */
export function FieldSwatch({ colorClassName }: { colorClassName: string }) {
  return <span aria-hidden className={cx('size-2.25 shrink-0 rounded-tick', colorClassName)} />;
}

export interface WatcherListProps {
  people: readonly FieldPersonProps[];
  /** The full count when only a page of watchers is given. */
  total?: number;
  className?: string;
}

/** Watchers as 20px avatars 4px apart, the Reviewers row of the Issue sidebar, with a count. */
export function WatcherList({ people, total, className }: WatcherListProps) {
  const count = total ?? people.length;
  return (
    <span
      role="group"
      aria-label={`${count} watching`}
      className={cx('inline-flex items-center gap-1', className)}
    >
      {people.map((person) => (
        <Avatar
          key={person.name}
          name={person.name}
          hue={person.hue}
          size={20}
          {...(person.initials ? { initials: person.initials } : {})}
        />
      ))}
      <span className="ml-1 text-12 text-tx5">{count} watching</span>
    </span>
  );
}
