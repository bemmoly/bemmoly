import { Skeleton } from '@bemmoly/ui';
import type { CSSProperties } from 'react';

/*
 * Pieces the screen skeletons share. Each bar sits in a line box of the text it stands for
 * (`h-[1lh]` at that text's size), so a skeleton is exactly as tall as what replaces it.
 */

type Width = CSSProperties['width'];

/** One line of text at a type size: a bar of `bar` px in a box of the line's height. */
export function LineSkeleton({
  width,
  size = 'text-13',
  bar = 10,
  className = '',
}: {
  width: Width;
  size?: string;
  bar?: number;
  className?: string;
}) {
  return (
    <span className={`flex h-[1lh] shrink-0 items-center ${size} ${className}`}>
      <Skeleton width={width} height={bar} />
    </span>
  );
}

/** A control: a button, a select, a search box, at its height and radius. */
export function ControlSkeleton({
  width,
  height = 32,
  className = '',
}: {
  width: Width;
  height?: number;
  className?: string;
}) {
  return <Skeleton width={width} height={height} className={`rounded-control ${className}`} />;
}

/**
 * The page header of the Board, the Backlog and settings pages: breadcrumbs, the 22px title
 * with an optional facts line, and the actions on the right.
 */
export function HeaderSkeleton({
  subtitle = false,
  actions = [],
  description = false,
  gap = 'gap-3',
}: {
  subtitle?: boolean;
  /** Widths of the action controls, left to right. */
  actions?: readonly number[];
  /** The settings pages' sentence under the title. */
  description?: boolean;
  gap?: string;
}) {
  return (
    <div className={`flex flex-col ${gap}`}>
      <LineSkeleton width={200} size="text-12h" bar={9} />
      <div className="flex items-start gap-4">
        <div className="flex flex-col gap-1">
          <LineSkeleton width={180} size="text-22" bar={16} />
          {subtitle && <LineSkeleton width={150} size="text-12h" bar={9} />}
        </div>
        <span className="ml-auto flex items-center gap-2">
          {actions.map((width, index) => (
            <ControlSkeleton key={index} width={width} />
          ))}
        </span>
      </div>
      {description && (
        <div className="flex flex-col">
          <LineSkeleton width="min(640px, 90%)" size="text-13 leading-body" bar={9} />
          <LineSkeleton width="min(380px, 60%)" size="text-13 leading-body" bar={9} />
        </div>
      )}
    </div>
  );
}
