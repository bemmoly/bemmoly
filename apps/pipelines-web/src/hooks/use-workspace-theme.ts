import { applyTheme, clearTheme, customThemeSource } from '@bemmoly/ui/theme';
import { DEFAULT_THEME, isThemeId, RETIRED_PRESETS, resolveSource } from '@bemmoly/ui/tokens';
import { useEffect } from 'react';
import type { PipelinesMode } from './use-mode.ts';
import { useMe } from './use-me.ts';

/**
 * Wears the workspace's theme and typeface (ADR 0021), as Bemmoly does: a built-in theme
 * through data-theme, a custom one as inline tokens. The mode stays Pipelines' own, dark
 * until the person picks light, so it is passed in rather than read from the workspace.
 */
export function useWorkspaceTheme(mode: PipelinesMode): void {
  const appearance = useMe().data?.workspace.appearance;
  useEffect(() => {
    if (!appearance) return;
    const root = document.documentElement;
    root.dataset['font'] = appearance.font;
    const custom =
      appearance.theme === 'custom'
        ? appearance.customThemes.find((theme) => theme.id === appearance.customThemeId)
        : undefined;
    if (custom) {
      const source = customThemeSource(custom.id, custom.name, {
        brand: custom.brandColor,
        surface: custom.surface,
      });
      applyTheme(root, resolveSource(source, mode));
      return;
    }
    const id = isThemeId(appearance.theme)
      ? appearance.theme
      : (RETIRED_PRESETS[appearance.theme]?.theme ?? DEFAULT_THEME);
    clearTheme(root, id);
    root.dataset['mode'] = mode;
  }, [appearance, mode]);
}
