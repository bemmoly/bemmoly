import { useGlobalKeys } from '@bemmoly/core-web';
import { useNavigate } from '@tanstack/react-router';
import { useUiStore } from '../store/ui.ts';
import { PLACES, SETTINGS } from './places.ts';

/**
 * The shell's keys: Mod+K for search and commands, T for light or dark, and "G, then a
 * letter" for each place (G Y For you, G M Map, G C Catalog …). Screen keys (J K, [ ]) belong
 * to the screens.
 */
export function useShellKeys(toggleMode: () => void): void {
  const navigate = useNavigate();
  const openPalette = useUiStore((state) => state.openPalette);
  const setKeysOpen = useUiStore((state) => state.setKeysOpen);
  const bindings: Record<string, () => void> = {
    'mod+k': openPalette,
    t: toggleMode,
    '?': () => setKeysOpen(true),
  };
  for (const place of [...PLACES, SETTINGS]) {
    bindings[place.keys.toLowerCase()] = () =>
      void navigate({ to: place.path, search: (previous) => (place.scoped ? previous : {}) });
  }
  useGlobalKeys(bindings);
}
