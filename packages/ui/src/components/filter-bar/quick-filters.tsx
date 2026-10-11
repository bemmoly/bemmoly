import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { Icon } from '../../icons/icon.tsx';
import { Menu } from '../menu/menu.tsx';
import { MenuItem } from '../menu/menu-item.tsx';
import { FilterChipButton } from './filter-bar.tsx';

/*
 * Quick filters in the filter row: one toggle chip per filter the board offers ("Only my
 * issues", "Recently updated", the project's own), pressed while it applies. The first few sit
 * in the row; the rest wait behind "+N more", except any that are on, which always show.
 */

export interface QuickFilterToggle {
  id: string;
  label: string;
  pressed: boolean;
  onToggle: () => void;
}

/** A solid 26px toggle: quiet while off, the accent tint while on (kit.css `.chip.on`). */
export function QuickFilterChip({ filter }: { filter: QuickFilterToggle }) {
  return (
    <button
      type="button"
      aria-pressed={filter.pressed}
      onClick={filter.onToggle}
      className={cx(
        'inline-flex h-6.5 max-w-48 shrink-0 cursor-pointer items-center gap-1 rounded-control border px-2 font-sans text-13 whitespace-nowrap',
        filter.pressed
          ? 'border-acc-100 bg-acc-50 text-acc hover:bg-acc-100'
          : 'border-line bg-transparent text-tx-2 hover:bg-hover hover:text-tx',
        focusRing,
      )}
    >
      {filter.pressed && <Icon name="check" size={12} />}
      <span className="truncate">{filter.label}</span>
    </button>
  );
}

export interface QuickFiltersProps {
  filters: readonly QuickFilterToggle[];
  /** How many chips sit in the row before "+N more" takes the rest. */
  maxVisible?: number;
}

/** Splits the filters: every one that is on, then the first off ones up to `max`. */
export function splitQuickFilters(filters: readonly QuickFilterToggle[], max: number) {
  const room = Math.max(max - filters.filter((filter) => filter.pressed).length, 0);
  const inline: QuickFilterToggle[] = [];
  const more: QuickFilterToggle[] = [];
  let offShown = 0;
  for (const filter of filters) {
    if (filter.pressed) inline.push(filter);
    else if (offShown < room) {
      inline.push(filter);
      offShown += 1;
    } else more.push(filter);
  }
  return { inline, more };
}

export function QuickFilters({ filters, maxVisible = 4 }: QuickFiltersProps) {
  if (filters.length === 0) return null;
  const { inline, more } = splitQuickFilters(filters, maxVisible);
  return (
    <span role="group" aria-label="Quick filters" className="flex shrink-0 items-center gap-1.5">
      {inline.map((filter) => (
        <QuickFilterChip key={filter.id} filter={filter} />
      ))}
      {more.length > 0 && (
        <Menu
          widthClassName="w-56 max-h-[min(400px,70vh)] overflow-y-auto"
          trigger={(props) => (
            <FilterChipButton {...props} aria-label={`${more.length} more quick filters`}>
              +{more.length} more
            </FilterChipButton>
          )}
        >
          {more.map((filter) => (
            <MenuItem
              key={filter.id}
              kind="checkbox"
              checked={filter.pressed}
              onSelect={filter.onToggle}
            >
              {filter.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </span>
  );
}
