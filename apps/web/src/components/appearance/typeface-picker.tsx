import type { ThemeFont } from '@bemmoly/shared';
import { FONT_IDS, FONTS } from '@bemmoly/ui/tokens';
import { useId } from 'react';

interface TypefacePickerProps {
  value: ThemeFont;
  onChange: (font: ThemeFont) => void;
}

/**
 * Typeface: four tiles (6px radius, 8px 10px) with "Ag" set in each face at
 * 16px semibold. The sample is drawn in the font it names, so it takes the
 * stack from the tokens rather than the page's own font.
 */
export function TypefacePicker({ value, onChange }: TypefacePickerProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="font-medium">
        Typeface
      </span>
      <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-4 gap-2">
        {FONT_IDS.map((font) => {
          const selected = font === value;
          return (
            <button
              key={font}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(font)}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-control border bg-sf px-2.5 py-2 text-left font-sans focus-ring ${
                selected ? 'border-ac shadow-ring' : 'border-br'
              }`}
            >
              <span
                aria-hidden="true"
                className="text-16 font-semibold text-tx"
                style={{ fontFamily: FONTS[font].stack }}
              >
                Ag
              </span>
              <span className="text-11h text-tx4">{FONTS[font].name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
