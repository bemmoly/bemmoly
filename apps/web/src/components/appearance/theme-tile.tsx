import { flatten } from '@bemmoly/ui/theme';
import { themeById } from '@bemmoly/ui/tokens';

export interface TileColors {
  bg: string;
  sf: string;
  ac: string;
  br: string;
}

/** A preset's own tokens for its tile: its page, card, accent and line. */
export function presetTileColors(id: string): TileColors {
  const { colors } = themeById(id);
  return {
    bg: colors.sunken,
    sf: colors.card,
    ac: colors.acc,
    br: flatten(colors.line, colors.card),
  };
}

interface ThemeTileProps {
  name: string;
  /** "Light" or "Dark", shown on the Appearance page; the wizard omits it. */
  mode?: string;
  colors: TileColors;
  selected: boolean;
  onSelect: () => void;
}

/**
 * The preset tile from the Setup and Appearance mocks: a 54px miniature of
 * the theme's surfaces and accent, then a dot and the name. The miniature
 * paints with the preset's own token values, which is the point of the tile.
 */
export function ThemeTile({ name, mode, colors, selected, onSelect }: ThemeTileProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex cursor-pointer flex-col gap-2 rounded-control border bg-card p-2 text-left font-sans ${
        selected ? 'border-acc shadow-ring' : 'border-line'
      }`}
    >
      <span
        aria-hidden="true"
        className="flex h-13.5 gap-1 overflow-hidden rounded-chip border p-1.5"
        style={{ background: colors.bg, borderColor: colors.br }}
      >
        <span className="w-5.5 rounded-chip" style={{ background: colors.sf }} />
        <span className="flex flex-1 flex-col gap-1">
          <span className="h-1.75 w-2/5 rounded-[2px]" style={{ background: colors.ac }} />
          <span className="h-3 rounded-chip" style={{ background: colors.sf }} />
          <span className="h-3 rounded-chip" style={{ background: colors.sf }} />
        </span>
      </span>
      <span className="flex items-center gap-1.5 text-13 font-medium text-tx">
        <span
          aria-hidden="true"
          className="size-2.5 rounded-full"
          style={{ background: colors.ac }}
        />
        {name}
        {mode ? <span className="ml-auto text-12 font-normal text-tx-3">{mode}</span> : null}
      </span>
    </button>
  );
}
