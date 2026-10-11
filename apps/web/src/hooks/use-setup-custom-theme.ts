import { contrastCheck } from '@bemmoly/ui/theme';
import { useState } from 'react';
import type { CustomThemeDraft } from '../store/setup.ts';
import { HEX_ERROR, normalizeHex } from './use-appearance-draft.ts';

/**
 * The custom build's inputs on the Look step, edited the way Settings › Appearance
 * edits them: a swatch or a valid hex sets the brand, and the hex field keeps
 * what was typed (with an error) until it is a colour.
 */
export function useSetupCustomTheme(
  value: CustomThemeDraft,
  onChange: (patch: Partial<CustomThemeDraft>) => void,
) {
  const [hexText, setHexText] = useState<string | null>(null);
  return {
    value,
    hex: {
      text: hexText ?? value.brand,
      error: hexText !== null && !normalizeHex(hexText) ? HEX_ERROR : null,
      onChange: (text: string) => {
        setHexText(text);
        const hex = normalizeHex(text);
        if (hex) onChange({ brand: hex });
      },
    },
    pickBrand: (brand: string) => {
      setHexText(null);
      onChange({ brand });
    },
    setMode: (mode: CustomThemeDraft['mode']) => onChange({ mode }),
    setSurfaces: (surfaces: CustomThemeDraft['surfaces']) => onChange({ surfaces }),
    setFont: (font: CustomThemeDraft['font']) => onChange({ font }),
    contrast: contrastCheck(value.brand).message,
  };
}

export type SetupCustomTheme = ReturnType<typeof useSetupCustomTheme>;
