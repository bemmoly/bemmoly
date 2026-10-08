import type { Appearance } from '../lib/appearance.ts';
import { describe, expect, it } from 'vitest';
import { NO_PERSONAL_THEME, presetLook, resolveAppearance } from '../lib/theme.ts';
import { isPresetId, useThemeStore } from './theme.ts';

const workspace = (patch: Partial<Appearance> = {}): Appearance => ({
  preset: 'ocean',
  custom: null,
  logoKey: null,
  policy: { memberModeSwitch: true, personalThemes: false },
  ...patch,
});

describe('resolveAppearance', () => {
  it('renders Classic light before a workspace look exists, with no personal choice', () => {
    expect(useThemeStore.getInitialState()).toMatchObject({ mode: 'system', preset: null });
    expect(resolveAppearance(undefined, { mode: 'system', preset: null })).toEqual({
      kind: 'preset',
      id: 'light',
      mode: 'light',
    });
  });

  it('honours an explicit personal choice before a workspace look exists', () => {
    expect(resolveAppearance(undefined, { mode: 'dark', preset: null })).toMatchObject({
      id: 'dark',
    });
    expect(resolveAppearance(undefined, { mode: 'system', preset: 'forest' })).toMatchObject({
      id: 'forest',
    });
  });

  it('uses the workspace preset and lets members override light or dark', () => {
    expect(resolveAppearance(workspace(), { mode: 'system', preset: null })).toMatchObject({
      kind: 'preset',
      id: 'ocean',
    });
    const light = resolveAppearance(workspace(), { mode: 'light', preset: null });
    expect(light).toMatchObject({ kind: 'custom', mode: 'light' });
  });

  it('ignores personal choices the policy does not allow', () => {
    const locked = workspace({ policy: { memberModeSwitch: false, personalThemes: false } });
    expect(resolveAppearance(locked, { mode: 'light', preset: 'rose' })).toMatchObject({
      id: 'ocean',
    });
    const open = workspace({ policy: { memberModeSwitch: true, personalThemes: true } });
    expect(resolveAppearance(open, { mode: 'system', preset: 'rose' })).toMatchObject({
      id: 'rose',
    });
  });

  it('shows a preview above the workspace look and every personal choice', () => {
    const preview = presetLook('midnight');
    const open = workspace({ policy: { memberModeSwitch: true, personalThemes: true } });
    expect(resolveAppearance(open, { mode: 'light', preset: 'rose' }, preview)).toBe(preview);
    expect(resolveAppearance(undefined, NO_PERSONAL_THEME, preview)).toBe(preview);
    expect(resolveAppearance(open, { mode: 'light', preset: 'rose' }, null)).toMatchObject({
      id: 'rose',
    });
  });

  it('builds a custom workspace theme from the brand colour', () => {
    const custom = workspace({
      preset: 'custom',
      custom: { brandColor: '#f97316', mode: 'light', surfaces: 'neutral', font: 'geist' },
    });
    const resolved = resolveAppearance(custom, { mode: 'dark', preset: null });
    expect(resolved.kind).toBe('custom');
    expect(resolved.mode).toBe('dark');
  });
});

describe('isPresetId', () => {
  it('accepts only known presets', () => {
    expect(isPresetId('midnight')).toBe(true);
    expect(isPresetId('neon')).toBe(false);
  });
});
