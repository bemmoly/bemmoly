import { PRESETS } from '@bemmoly/ui/tokens';

export interface TileColors {
  bg: string;
  sf: string;
  ac: string;
  br: string;
}

/** A preset's own tokens for its tile: light presets outline with br3, dark ones with br. */
export function presetTileColors(id: string): TileColors {
  const preset = PRESETS.find((entry) => entry.id === id) ?? PRESETS[0];
  return {
    bg: preset.neutrals.bg,
    sf: preset.neutrals.sf,
    ac: preset.accent[0],
    br: preset.mode === 'dark' ? preset.neutrals.br : preset.neutrals.br3,
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
      className={`flex cursor-pointer flex-col gap-2 rounded-panel border bg-sf p-2 text-left font-sans ${
        selected ? 'border-ac shadow-ring' : 'border-br'
      }`}
    >
      <span
        aria-hidden="true"
        className="flex h-13.5 gap-1 overflow-hidden rounded-sm border p-1.5"
        style={{ background: colors.bg, borderColor: colors.br }}
      >
        <span className="w-5.5 rounded-chip" style={{ background: colors.sf }} />
        <span className="flex flex-1 flex-col gap-1">
          <span className="h-1.75 w-2/5 rounded-[2px]" style={{ background: colors.ac }} />
          <span className="h-3 rounded-chip" style={{ background: colors.sf }} />
          <span className="h-3 rounded-chip" style={{ background: colors.sf }} />
        </span>
      </span>
      <span className="flex items-center gap-1.5 text-12h font-medium text-tx">
        <span
          aria-hidden="true"
          className="size-2.5 rounded-full"
          style={{ background: colors.ac }}
        />
        {name}
        {mode ? <span className="ml-auto text-11h font-normal text-tx5">{mode}</span> : null}
      </span>
    </button>
  );
}
