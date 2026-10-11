import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { themeSource } from '@bemmoly/ui/tokens';
import type { LookPreview } from '../lib/theme.ts';

const presetLook = (id: string): LookPreview => ({ source: themeSource(id) });
import { useThemePreviewStore } from '../store/theme-preview.ts';
import { clearThemePreview, useThemePreview } from './use-theme-preview.ts';

const current = () => useThemePreviewStore.getState().preview;

afterEach(clearThemePreview);

describe('useThemePreview', () => {
  it('shows the preview while mounted, follows changes and drops it on leaving', () => {
    const forest = presetLook('pine');
    const midnight = presetLook('graphite');
    const { rerender, unmount } = renderHook(
      ({ look }: { look: LookPreview | null }) => useThemePreview(look),
      { initialProps: { look: forest } as { look: LookPreview | null } },
    );
    expect(current()).toBe(forest);
    rerender({ look: midnight });
    expect(current()).toBe(midnight);
    rerender({ look: null });
    expect(current()).toBeNull();
    rerender({ look: forest });
    unmount();
    expect(current()).toBeNull();
  });

  it('can be dropped at once, and is never persisted across reloads', () => {
    useThemePreviewStore.getState().setPreview(presetLook('sand'));
    clearThemePreview();
    expect(current()).toBeNull();
    expect('persist' in useThemePreviewStore).toBe(false);
  });
});
