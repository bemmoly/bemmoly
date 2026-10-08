import { applyTheme, clearTheme } from '@bemmoly/ui/theme';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { resolveAppearance } from '../lib/theme.ts';
import { useThemePreviewStore } from '../store/theme-preview.ts';
import { useThemeStore } from '../store/theme.ts';
import { workspaceQuery } from './use-workspace.ts';

/**
 * Applies the resolved look to <html>: a preset through `data-theme`, a custom
 * theme as inline tokens. `data-mode` records light or dark for anything that
 * needs to know. Reads the workspace look from the cache only; it never fetches.
 * A preview set through useThemePreview is applied by this same path.
 */
export function useThemeEffect(): void {
  const { data: workspace } = useQuery({ ...workspaceQuery, enabled: false });
  const mode = useThemeStore((state) => state.mode);
  const preset = useThemeStore((state) => state.preset);
  const preview = useThemePreviewStore((state) => state.preview);
  const appearance = workspace?.appearance;
  const resolved = useMemo(
    () => resolveAppearance(appearance, { mode, preset }, preview),
    [appearance, mode, preset, preview],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset['mode'] = resolved.mode;
    if (resolved.kind === 'preset') clearTheme(root, resolved.id);
    else applyTheme(root, resolved.theme);
  }, [resolved]);
}
