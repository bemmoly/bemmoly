import type { ReactNode } from 'react';
import { PageIcon } from '../../icons/page-icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';
import { Avatar, type AvatarHue } from '../avatar/avatar.tsx';
import { Skeleton } from '../skeleton/skeleton.tsx';

/** The Docs home list's tracks: icon, title and place, person, when. */
export const DOC_LIST_TEMPLATE = '20px minmax(0,1fr) 130px 120px';

/**
 * The tracks as classes: the mock's four, and on a phone three, with the person dropped so
 * the title keeps its room.
 */
const TRACKS =
  'grid-cols-[20px_minmax(0,1fr)_130px_120px] max-sm:grid-cols-[20px_minmax(0,1fr)_auto]';

export interface DocListRowProps {
  href: string;
  title: string;
  /** The page's emoji or icon name; the doc icon otherwise. */
  icon?: string | null;
  /** Where the page lives: "Engineering / Architecture". */
  place: ReactNode;
  /** After the place, in the accent: linked issue keys. */
  links?: ReactNode;
  person?: { name: string; hue?: AvatarHue } | null;
  /** "2h ago", or "Draft · Friday" in the drafts list. */
  when: ReactNode;
  className?: string;
}

/**
 * One page in the Recent, Starred and Drafts lists of the Docs mock: a 4-track grid 10px
 * apart, 10px 16px padding, divided by br-row. The whole row is the link.
 */
export function DocListRow({
  href,
  title,
  icon,
  place,
  links,
  person,
  when,
  className,
}: DocListRowProps) {
  return (
    <a
      href={href}
      className={cx(
        'grid items-center',
        TRACKS,
        'gap-2.5 border-b border-line-2 px-4 py-2.5 text-13 text-tx no-underline last:border-b-0',
        'hover:bg-side hover:text-tx motion-safe:transition-colors',
        focusRingInset,
        className,
      )}
    >
      <span aria-hidden className="flex justify-center text-tx-3">
        <PageIcon value={icon} size={16} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{title || 'Untitled'}</span>
        <span className="truncate text-12 text-tx-3">
          {place}
          {links && (
            <>
              {' · '}
              <span className="text-acc">{links}</span>
            </>
          )}
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-12 text-tx-2 max-sm:hidden">
        {person && (
          <>
            <Avatar name={person.name} size={20} {...(person.hue ? { hue: person.hue } : {})} />
            <span className="truncate">{person.name}</span>
          </>
        )}
      </span>
      <span className="truncate text-12 text-tx-3">{when}</span>
    </a>
  );
}

/** Rows while a list loads, in the same grid so nothing shifts when they arrive. */
export function DocListRowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <span aria-hidden className="flex flex-col">
      {Array.from({ length: rows }, (_, index) => (
        <span
          key={index}
          className={`grid items-center gap-2.5 border-b border-line-2 px-4 py-2.5 last:border-b-0 ${TRACKS}`}
        >
          <Skeleton width={14} height={16} shape="block" className="justify-self-center" />
          <span className="flex flex-col gap-1.5 py-0.5">
            <Skeleton width={`${70 - index * 7}%`} height={12} />
            <Skeleton width={`${40 - index * 3}%`} height={10} />
          </span>
          <span className="flex items-center gap-1.5 max-sm:hidden">
            <Skeleton width={20} height={20} shape="circle" />
            <Skeleton width={56} height={10} />
          </span>
          <Skeleton width={52} height={10} />
        </span>
      ))}
    </span>
  );
}
