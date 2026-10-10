import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';
import { Menu } from '../menu/menu.tsx';
import { MenuGroup, MenuItem, MenuSeparator } from '../menu/menu-item.tsx';
import { Skeleton } from '../skeleton/skeleton.tsx';
import { SpaceTile, type SpaceTone } from './space-tile.tsx';

export interface SwitcherSpace {
  id: string;
  key: string;
  name: string;
  tone: SpaceTone;
}

export interface SpaceSwitcherProps {
  /** The space the sidebar shows. */
  current: SwitcherSpace;
  /** "184 pages". */
  meta: ReactNode;
  /** Every space the person can open, the current one included. */
  spaces: readonly SwitcherSpace[];
  onSelect: (space: SwitcherSpace) => void;
  /** "All spaces": back to the Docs home. */
  onShowAll?: () => void;
  onCreate?: () => void;
  className?: string;
}

/**
 * The head of the space sidebar, from the Doc Editor mock: a 30px tile, 13.5px semibold
 * name over a 12px tx4 count, 16px 16px 10px around. It is also the way to another space:
 * the whole head opens a menu of spaces; its caret shows on hover and focus only, so at
 * rest it reads as the mock does.
 */
export function SpaceSwitcher({
  current,
  meta,
  spaces,
  onSelect,
  onShowAll,
  onCreate,
  className,
}: SpaceSwitcherProps) {
  return (
    <div className={cx('px-2 pt-2 pb-0.5', className)}>
      <Menu
        widthClassName="w-60"
        trigger={(props) => (
          <button
            type="button"
            {...props}
            aria-label={`${current.name}, switch space`}
            className={cx(
              'group flex w-full cursor-pointer items-center gap-2.5 rounded-control border-0 bg-transparent px-2 py-2 text-left font-sans',
              'hover:bg-bg2 aria-expanded:bg-bg2',
              focusRingInset,
            )}
          >
            <SpaceTile name={current.name} spaceKey={current.key} tone={current.tone} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="truncate text-13h font-semibold text-tx">{current.name}</span>
              <span className="truncate text-12 text-tx4">{meta}</span>
            </span>
            <Icon
              name="caret"
              size={14}
              className="text-tx5 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-aria-expanded:opacity-100"
            />
          </button>
        )}
      >
        <MenuGroup label="Spaces">
          {spaces.map((space) => (
            <MenuItem
              key={space.id}
              onSelect={() => onSelect(space)}
              icon={
                <SpaceTile name={space.name} spaceKey={space.key} tone={space.tone} size="xs" />
              }
              hint={space.id === current.id ? <Icon name="check" size={14} /> : space.key}
            >
              {space.name}
            </MenuItem>
          ))}
        </MenuGroup>
        {(onShowAll || onCreate) && <MenuSeparator />}
        {onShowAll && (
          <MenuItem onSelect={onShowAll} icon={<Icon name="doc" size={16} />}>
            All spaces
          </MenuItem>
        )}
        {onCreate && (
          <MenuItem onSelect={onCreate} icon={<Icon name="plus" size={16} />}>
            Create space
          </MenuItem>
        )}
      </Menu>
    </div>
  );
}

/** The head while the space loads: the same 30px tile and two lines. */
export function SpaceSwitcherSkeleton() {
  return (
    <span aria-hidden className="flex items-center gap-2.5 px-4 pt-4 pb-2.5">
      <Skeleton width={30} height={30} shape="block" />
      <span className="flex flex-col gap-1.5">
        <Skeleton width={96} height={12} />
        <Skeleton width={56} height={10} />
      </span>
    </span>
  );
}
