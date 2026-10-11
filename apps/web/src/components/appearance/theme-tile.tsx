import { Icon } from '@bemmoly/ui/icons';
import type { ThemeSource } from '@bemmoly/ui/tokens';
import { themeScope } from '../../lib/theme-scope.ts';
import { BoardMiniature } from '../setup/board-miniature.tsx';

interface ThemeTileProps {
  source: ThemeSource;
  selected: boolean;
  onSelect: () => void;
  /** A word under the name when not selected: the theme's tag, or "Custom". */
  note?: string;
}

/**
 * One theme as the review draws it: its light and dark designs side by side, each painted by
 * the theme itself, then a half-and-half dot and the name. A theme is a pair, so the tile
 * shows both halves whatever mode the page is in.
 */
export function ThemeTile({ source, selected, onSelect, note }: ThemeTileProps) {
  const light = themeScope(source, 'light');
  const dark = themeScope(source, 'dark');
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={source.name}
      onClick={onSelect}
      className={`flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-card border bg-card p-1.5 text-left font-sans focus-ring ${
        selected ? 'border-acc shadow-ring' : 'border-line'
      }`}
    >
      <span className="grid grid-cols-2 gap-1">
        <BoardMiniature scope={light} />
        <BoardMiniature scope={dark} />
      </span>
      <span className="flex min-w-0 items-center gap-1.5 px-0.5">
        <span aria-hidden="true" className="flex size-2.5 shrink-0 overflow-hidden rounded-full">
          <span {...light} className="h-full w-1/2 bg-acc-fill" />
          <span {...dark} className="h-full w-1/2 bg-acc" />
        </span>
        <span className="min-w-0 truncate text-12 font-semibold text-tx">{source.name}</span>
        {selected ? (
          <Icon name="check" size={14} className="ml-auto shrink-0 text-acc" />
        ) : note ? (
          <span className="ml-auto shrink-0 text-11 text-tx-3">{note}</span>
        ) : null}
      </span>
    </button>
  );
}
