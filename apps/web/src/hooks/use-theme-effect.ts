import { useEffect, useState } from 'react';
import { resolveThemeChoice, useThemeStore } from '../store/theme.ts';

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

/** Applies the chosen preset as `data-theme` on <html>; tokens are CSS variables. */
export function useThemeEffect(): void {
  const choice = useThemeStore((state) => state.choice);
  const prefersDark = usePrefersDark();
  const preset = resolveThemeChoice(choice, prefersDark);
  useEffect(() => {
    document.documentElement.dataset['theme'] = preset;
  }, [preset]);
}
