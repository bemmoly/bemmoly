import { applyTheme, clearTheme, themeStyle } from '@bemmoly/ui/theme';
import { resolveSource } from '@bemmoly/ui/tokens';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { rememberBootLook } from '../lib/boot-frame.ts';
import { resolveLook, type Look } from '../lib/theme.ts';
import { useThemePreviewStore } from '../store/theme-preview.ts';
import { useThemeStore } from '../store/theme.ts';
import { meQuery } from './use-session.ts';
import { useSystemDark } from './use-system-dark.ts';
import { workspaceQuery } from './use-workspace.ts';

/**
 * The look this person sees right now. Reads the workspace look and /me from the cache only;
 * it never fetches, so it works before sign-in too, from the device cache.
 */
export function useLook(): Look {
  const { data: workspace } = useQuery({ ...workspaceQuery, enabled: false });
  const { data: me } = useQuery({ ...meQuery, enabled: false });
  const mode = useThemeStore((state) => state.mode);
  const theme = useThemeStore((state) => state.theme);
  const preview = useThemePreviewStore((state) => state.preview);
  const systemDark = useSystemDark();
  const appearance = workspace?.appearance;
  return useMemo(
    () =>
      resolveLook({
        appearance,
        personal: { mode, theme },
        customThemes: [...(appearance?.customThemes ?? []), ...(me?.customThemes ?? [])],
        preview,
        systemDark,
      }),
    [appearance, me?.customThemes, mode, theme, preview, systemDark],
  );
}

/**
 * Applies the look to <html>: a built-in theme through `data-theme` and `data-mode`, a custom
 * one as inline tokens, the typeface through `data-font`. Match system re-runs this whenever
 * the device switches between light and dark.
 */
export function useThemeEffect(): void {
  const look = useLook();
  const previewing = useThemePreviewStore((state) => state.preview !== null);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset['font'] = look.font;
    if (look.custom) {
      applyTheme(root, resolveSource(look.source, look.mode));
    } else {
      clearTheme(root, look.source.id);
      root.dataset['mode'] = look.mode;
    }
    // A look being tried on is not the person's; the boot frame keeps the saved one.
    if (previewing) return;
    rememberBootLook(
      look.custom
        ? {
            theme: look.source.id,
            mode: look.mode,
            font: look.font,
            vars: themeStyle(resolveSource(look.source, look.mode)),
          }
        : { theme: look.source.id, mode: look.preference, font: look.font },
    );
  }, [look, previewing]);
}
