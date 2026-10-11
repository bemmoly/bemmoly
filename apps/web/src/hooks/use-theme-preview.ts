import { useEffect } from 'react';
import type { LookPreview } from '../lib/theme.ts';
import { useThemePreviewStore } from '../store/theme-preview.ts';

/**
 * Shows `preview` on the whole page while the calling component is mounted;
 * null shows the saved look. Leaving the component, by any route, drops the
 * preview. Pass a memoised value so the page is not re-themed on every render.
 */
export function useThemePreview(preview: LookPreview | null): void {
  const setPreview = useThemePreviewStore((state) => state.setPreview);
  useEffect(() => {
    setPreview(preview);
    return () => setPreview(null);
  }, [preview, setPreview]);
}

/** Drops the preview now, once the saved look is in place. */
export function clearThemePreview(): void {
  useThemePreviewStore.getState().setPreview(null);
}
