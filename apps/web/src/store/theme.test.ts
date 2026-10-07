import type { Appearance } from '../lib/appearance.ts';
import { describe, expect, it } from 'vitest';
import { resolveAppearance } from '../lib/theme.ts';
import { isPresetId } from './theme.ts';

const workspace = (patch: Partial<Appearance> = {}): Appearance => ({
  preset: 'ocean',
  custom: null,
  logoKey: null,
  policy: { memberModeSwitch: true, personalThemes: false },
  ...patch,
});

describe('resolveAppearance', () => {
  it('follows the OS when signed out with no personal choice', () => {
    expect(resolveAppearance(undefined, { mode: 'system', preset: null }, true)).toMatchObject({
      kind: 'preset',
      id: 'dark',
    });
  });

  it('uses the workspace preset and lets members override light or dark', () => {
    expect(resolveAppearance(workspace(), { mode: 'system', preset: null }, false)).toMatchObject({
      kind: 'preset',
      id: 'ocean',
    });
    const light = resolveAppearance(workspace(), { mode: 'light', preset: null }, false);
    expect(light).toMatchObject({ kind: 'custom', mode: 'light' });
  });

  it('ignores personal choices the policy does not allow', () => {
    const locked = workspace({ policy: { memberModeSwitch: false, personalThemes: false } });
    expect(resolveAppearance(locked, { mode: 'light', preset: 'rose' }, false)).toMatchObject({
      id: 'ocean',
    });
    const open = workspace({ policy: { memberModeSwitch: true, personalThemes: true } });
    expect(resolveAppearance(open, { mode: 'system', preset: 'rose' }, false)).toMatchObject({
      id: 'rose',
    });
  });

  it('builds a custom workspace theme from the brand colour', () => {
    const custom = workspace({
      preset: 'custom',
      custom: { brandColor: '#f97316', mode: 'light', surfaces: 'neutral', font: 'geist' },
    });
    const resolved = resolveAppearance(custom, { mode: 'dark', preset: null }, false);
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
