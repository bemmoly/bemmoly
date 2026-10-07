import { applyTheme, clearTheme } from '@bemmoly/ui/theme';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { resolveAppearance } from '../lib/theme.ts';
import { useThemeStore } from '../store/theme.ts';
import { workspaceQuery } from './use-workspace.ts';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function usePrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia(DARK_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return prefersDark;
}

/**
 * Applies the resolved look to <html>: a preset through `data-theme`, a custom
 * theme as inline tokens. `data-mode` records light or dark for anything that
 * needs to know. Reads the workspace look from the cache only; it never fetches.
 */
export function useThemeEffect(): void {
  const { data: workspace } = useQuery({ ...workspaceQuery, enabled: false });
  const mode = useThemeStore((state) => state.mode);
  const preset = useThemeStore((state) => state.preset);
  const prefersDark = usePrefersDark();
  const appearance = workspace?.appearance;
  const resolved = useMemo(
    () => resolveAppearance(appearance, { mode, preset }, prefersDark),
    [appearance, mode, preset, prefersDark],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset['mode'] = resolved.mode;
    if (resolved.kind === 'preset') clearTheme(root, resolved.id);
    else applyTheme(root, resolved.theme);
  }, [resolved]);
}
