import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { presetLook, type ResolvedAppearance } from '../lib/theme.ts';
import { useThemePreviewStore } from '../store/theme-preview.ts';
import { clearThemePreview, useThemePreview } from './use-theme-preview.ts';

const current = () => useThemePreviewStore.getState().preview;

afterEach(clearThemePreview);

describe('useThemePreview', () => {
  it('shows the preview while mounted, follows changes and drops it on leaving', () => {
    const forest = presetLook('forest');
    const midnight = presetLook('midnight');
    const { rerender, unmount } = renderHook(
      ({ look }: { look: ResolvedAppearance | null }) => useThemePreview(look),
      { initialProps: { look: forest } as { look: ResolvedAppearance | null } },
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
    useThemePreviewStore.getState().setPreview(presetLook('rose'));
    clearThemePreview();
    expect(current()).toBeNull();
    expect('persist' in useThemePreviewStore).toBe(false);
  });
});
