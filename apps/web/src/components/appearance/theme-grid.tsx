import type { ReactNode } from 'react';
import type { ThemeOption } from '../../hooks/use-theme-options.ts';
import { ThemeTile } from './theme-tile.tsx';

interface ThemeGridProps {
  options: readonly ThemeOption[];
  selected: string;
  onSelect: (ref: string) => void;
  /** The "Your brand colour" tile, after the themes. */
  extra?: ReactNode;
  disabled?: boolean;
}

/** The five themes and any custom ones, two to a row in the settings reading column. */
export function ThemeGrid({ options, selected, onSelect, extra, disabled }: ThemeGridProps) {
  return (
    <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3">
        {options.map((option) => (
          <ThemeTile
            key={option.ref}
            source={option.source}
            note={option.note}
            selected={option.ref === selected}
            onSelect={() => onSelect(option.ref)}
          />
        ))}
        {extra}
      </div>
    </fieldset>
  );
}

interface BrandTileProps {
  title: string;
  description: string;
  action: ReactNode;
}

/** The last tile: one brand colour in, a checked light and dark theme out. */
export function BrandTile({ title, description, action }: BrandTileProps) {
  return (
    <div className="flex min-w-0 flex-col items-start justify-center gap-2 rounded-card border border-line p-2.5">
      <span className="flex items-center gap-1.5 text-12 font-semibold text-tx">
        <span aria-hidden="true" className="size-3.5 rounded-full bg-acc-fill" />
        {title}
      </span>
      <span className="text-12 text-tx-3">{description}</span>
      {action}
    </div>
  );
}
