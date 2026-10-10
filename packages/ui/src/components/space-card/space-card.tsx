import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { Avatar, type AvatarHue } from '../avatar/avatar.tsx';
import { Skeleton } from '../skeleton/skeleton.tsx';
import { SpaceTile, type SpaceTone } from './space-tile.tsx';

export interface SpaceCardPerson {
  id: string;
  name: string;
  hue?: AvatarHue;
}

export interface SpaceCardProps {
  href: string;
  name: string;
  /** The space key; the tile's letters come from it. */
  spaceKey?: string;
  tone: SpaceTone;
  /** "184 pages", or "31 pages · linked to PLT". */
  meta: ReactNode;
  /** A project space carries the PROJECT tag. */
  project?: boolean;
  /** Up to three page titles: the space's top pages. */
  pages?: readonly string[];
  /** People who write in the space, drawn overlapping. */
  people?: readonly SpaceCardPerson[];
  className?: string;
}

/**
 * A space on the Docs home: 16px padding, 12px between the header, the top pages and the
 * people; the tile is 34px. The whole card is the link into the space.
 */
export function SpaceCard({
  href,
  name,
  spaceKey,
  tone,
  meta,
  project,
  pages = [],
  people = [],
  className,
}: SpaceCardProps) {
  return (
    <a
      href={href}
      className={cx(
        'flex flex-col gap-3 rounded-card border border-br bg-sf p-4 text-tx no-underline',
        'hover:border-br3 hover:text-tx motion-safe:transition-colors',
        focusRing,
        className,
      )}
    >
      <span className="flex items-center gap-2.5">
        <SpaceTile name={name} {...(spaceKey ? { spaceKey } : {})} tone={tone} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-14 font-semibold">{name}</span>
          <span className="truncate text-12 text-tx5">{meta}</span>
        </span>
        {project && (
          <span className="ml-auto rounded-chip bg-ac-bg px-1.75 py-0.5 text-11 font-semibold text-ac">
            PROJECT
          </span>
        )}
      </span>
      {pages.length > 0 && (
        <span className="flex flex-col gap-1.25 text-12h text-tx2">
          {pages.slice(0, 3).map((title, index) => (
            <span key={index} className="flex items-center gap-1.75 overflow-hidden">
              <Icon name="doc" size={12} className="text-tx6" />
              <span className="truncate">{title || 'Untitled'}</span>
            </span>
          ))}
        </span>
      )}
      {people.length > 0 && (
        <span className="mt-auto flex pl-1.25">
          {people.slice(0, 5).map((person) => (
            <Avatar
              key={person.id}
              name={person.name}
              {...(person.hue ? { hue: person.hue } : {})}
              ring="sf"
              className="-ml-1.25"
            />
          ))}
        </span>
      )}
    </a>
  );
}

/** A space card while the spaces load: the same box, tile, two lines and three page rows. */
export function SpaceCardSkeleton() {
  return (
    <span aria-hidden className="flex flex-col gap-3 rounded-card border border-br bg-sf p-4">
      <span className="flex items-center gap-2.5">
        <Skeleton width={34} height={34} shape="block" />
        <span className="flex flex-col gap-1.5">
          <Skeleton width={110} height={12} />
          <Skeleton width={64} height={10} />
        </span>
      </span>
      <span className="flex flex-col gap-2">
        <Skeleton width="62%" height={10} />
        <Skeleton width="48%" height={10} />
        <Skeleton width="56%" height={10} />
      </span>
    </span>
  );
}
