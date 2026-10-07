import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { themeVariables } from '../components/placeholders/theme.ts';
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
 * Applies the resolved look to <html>: `data-theme` picks a preset's CSS
 * variables; a custom theme sets them inline. `data-mode` drives the status
 * tints. Reads the session from the cache only; it never fetches.
 */
export function useThemeEffect(): void {
  const { data: workspace } = useQuery({ ...workspaceQuery, enabled: false });
  const mode = useThemeStore((state) => state.mode);
  const preset = useThemeStore((state) => state.preset);
  const prefersDark = usePrefersDark();
  const resolved = resolveAppearance(workspace?.appearance, { mode, preset }, prefersDark);
  const theme = resolved.kind === 'preset' ? resolved.id : 'custom';
  const vars = resolved.kind === 'custom' ? JSON.stringify(themeVariables(resolved.theme)) : '';
  const resolvedMode = resolved.mode;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset['mode'] = resolvedMode;
    root.dataset['theme'] = theme;
    root.removeAttribute('style');
    if (!vars) return;
    for (const [name, value] of Object.entries(JSON.parse(vars) as Record<string, string>)) {
      root.style.setProperty(name, value);
    }
  }, [theme, vars, resolvedMode]);
}
