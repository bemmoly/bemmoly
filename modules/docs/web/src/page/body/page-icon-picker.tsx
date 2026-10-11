import {
  formatPageIcon,
  Icon,
  PAGE_ICON_TINTS,
  pageIconTintClass,
  parsePageIcon,
  type IconName,
  type PageIconTint,
} from '@bemmoly/ui/icons';
import { useState, type KeyboardEvent } from 'react';
import { cx } from '../cx.ts';

/** The drawn icons a page can wear: the kit's own, chosen to tell documents apart. */
export const PAGE_ICON_CHOICES: readonly IconName[] = [
  'doc',
  'flag',
  'layers',
  'palette',
  'alert',
  'bug',
  'rocket',
  'idea',
  'target',
  'calendar',
  'roadmap',
  'people',
  'code',
  'server',
  'shield',
  'key',
  'wrench',
  'megaphone',
  'globe',
  'heart',
  'flame',
  'puzzle',
  'smile',
  'bookmark',
];

const TINT_NAMES: Record<PageIconTint, string> = {
  'epic-1': 'Blue',
  'epic-2': 'Violet',
  'epic-3': 'Teal',
  'epic-4': 'Orange',
  'epic-5': 'Green',
  'epic-6': 'Rose',
  'epic-7': 'Ochre',
  'epic-8': 'Plum',
};

const TINT_SWATCH: Record<PageIconTint, string> = {
  'epic-1': 'bg-epic-1',
  'epic-2': 'bg-epic-2',
  'epic-3': 'bg-epic-3',
  'epic-4': 'bg-epic-4',
  'epic-5': 'bg-epic-5',
  'epic-6': 'bg-epic-6',
  'epic-7': 'bg-epic-7',
  'epic-8': 'bg-epic-8',
};

const COLUMNS = 8;

/** Arrow keys move through a grid of buttons, as a picker's cells. */
function walkGrid(event: KeyboardEvent<HTMLElement>) {
  const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }[event.key];
  if (!step) return;
  const cells = [...event.currentTarget.querySelectorAll<HTMLElement>('button')];
  const index = cells.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  event.preventDefault();
  cells[Math.max(0, Math.min(cells.length - 1, index + step))]?.focus();
}

const CELL =
  'grid size-8 cursor-pointer place-items-center rounded-control border-0 bg-transparent hover:bg-hover focus-visible:shadow-ring focus-visible:outline-0 aria-pressed:bg-acc-50';

export interface PageIconPickerProps {
  /** The stored icon, or null. */
  value: string | null;
  onChange: (value: string | null) => void;
}

/**
 * Eight tints over a grid of drawn icons. Choosing an icon saves it in the tint shown;
 * choosing a tint recolours the current icon at once. Remove goes back to the plain page.
 */
export function PageIconPicker({ value, onChange }: PageIconPickerProps) {
  const current = parsePageIcon(value);
  const [tint, setTint] = useState<PageIconTint>(current?.tint ?? 'epic-1');
  const pickTint = (next: PageIconTint) => {
    setTint(next);
    if (current) onChange(formatPageIcon(current.name, next));
  };
  return (
    <div className="flex w-72 flex-col gap-2 p-1">
      <div role="radiogroup" aria-label="Tint" className="flex items-center gap-1.5 px-1 pt-1">
        {PAGE_ICON_TINTS.map((item) => (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={tint === item}
            aria-label={TINT_NAMES[item]}
            title={TINT_NAMES[item]}
            onClick={() => pickTint(item)}
            className={cx(
              'size-5 cursor-pointer rounded-full border-2 border-card p-0 focus-visible:shadow-ring focus-visible:outline-0',
              TINT_SWATCH[item],
              tint === item && 'shadow-[0_0_0_2px_var(--tx)]',
            )}
          />
        ))}
      </div>
      <div
        role="group"
        aria-label="Icons"
        onKeyDown={walkGrid}
        className={cx('grid grid-cols-8 gap-0.5', pageIconTintClass(tint))}
      >
        {PAGE_ICON_CHOICES.map((name) => (
          <button
            key={name}
            type="button"
            aria-label={name}
            aria-pressed={current?.name === name}
            onClick={() => onChange(formatPageIcon(name, tint))}
            className={CELL}
          >
            <Icon name={name} size={18} />
          </button>
        ))}
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="flex h-8 cursor-pointer items-center gap-2 rounded-control border-0 bg-transparent px-2 font-sans text-13 text-tx-2 hover:bg-hover focus-visible:shadow-ring focus-visible:outline-0"
        >
          <Icon name="trash" size={14} />
          Remove icon
        </button>
      )}
    </div>
  );
}
