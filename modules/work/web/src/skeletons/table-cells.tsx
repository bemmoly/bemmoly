import { Skeleton, TableSkeletonLine } from '@bemmoly/ui';

/*
 * Stand-ins for the richer cells of the Work tables, each as tall as the cell it replaces,
 * for the design system's TableSkeleton.
 */

/** A name over a 12px second line, with an optional avatar before them (members, projects). */
export function TwoLineCell({
  width = '46%',
  second = '64%',
  avatar,
}: {
  width?: string;
  second?: string;
  avatar?: number;
}) {
  return (
    <span className="flex w-full min-w-0 items-center gap-2.5">
      {avatar && <Skeleton width={avatar} height={avatar} shape="circle" />}
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <TableSkeletonLine width={width} />
        <span className="flex h-[1lh] items-center text-12">
          <Skeleton width={second} height={8} />
        </span>
      </span>
    </span>
  );
}

/** A small control or tag: a Select, a role picker, a method tag. */
export function BoxCell({ width, height = 20 }: { width: number; height?: number }) {
  return <Skeleton width={width} height={height} className="rounded-sm" />;
}

/** The row menu's ··· button. */
export function MenuCell() {
  return <Skeleton width={16} height={4} className="rounded-full" />;
}
