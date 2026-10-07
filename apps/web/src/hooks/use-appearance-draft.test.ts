import type { SettingKey } from '@bemmoly/shared';
import { PRESETS } from '@bemmoly/ui/tokens';
import { describe, expect, it } from 'vitest';
import { APPEARANCE_KEYS, type AppearanceKey } from '../lib/appearance.ts';
import {
  appearanceDescription,
  draftFrom,
  draftWrites,
  normalizeHex,
  previewLabel,
  themeOptions,
  themeScope,
  toAppearance,
  type AppearanceDraft,
} from './use-appearance-draft.ts';
import type { SettingReads } from './use-setting.ts';

function readsOf(values: Partial<Record<SettingKey, unknown>>): SettingReads<AppearanceKey> {
  return Object.fromEntries(
    APPEARANCE_KEYS.map((key) => [
      key,
      { key, value: values[key], isSet: values[key] !== undefined, isDefault: false },
    ]),
  ) as SettingReads<AppearanceKey>;
}

const BASE: AppearanceDraft = {
  preset: 'light',
  brand: '#f97316',
  mode: 'light',
  surfaces: 'neutral',
  font: 'plex',
  memberModeSwitch: true,
  personalThemes: false,
};

describe('appearance draft', () => {
  it('reads the server\'s "classic" as the Classic preset and keeps the stored brand', () => {
    const draft = draftFrom(
      readsOf({ 'appearance.theme': 'classic', 'appearance.brandColor': '#2456c9' }),
    );
    expect(draft.preset).toBe('light');
    expect(draft.brand).toBe('#2456c9');
    expect(toAppearance(draft).custom).toBeNull();
  });

  it('reads a custom theme with its builder inputs', () => {
    const draft = draftFrom(
      readsOf({
        'appearance.theme': 'custom',
        'appearance.brandColor': '#7c3aed',
        'appearance.mode': 'dark',
        'appearance.surfaces': 'tinted',
        'appearance.font': 'geist',
      }),
    );
    expect(draft).toMatchObject({
      preset: 'custom',
      brand: '#7c3aed',
      mode: 'dark',
      font: 'geist',
    });
    expect(toAppearance(draft).custom).toEqual({
      brandColor: '#7c3aed',
      mode: 'dark',
      surfaces: 'tinted',
      font: 'geist',
    });
  });

  it('falls back to Classic for a preset it does not know', () => {
    expect(draftFrom(readsOf({ 'appearance.theme': 'neon' })).preset).toBe('light');
  });

  it('keeps the builder inputs when moving between a preset and Custom', () => {
    const custom = { ...BASE, preset: 'custom', brand: '#e11d48', mode: 'dark' as const };
    const preset = { ...custom, preset: 'ocean' };
    expect(toAppearance(preset).custom).toBeNull();
    expect(toAppearance({ ...preset, preset: 'custom' }).custom?.brandColor).toBe('#e11d48');
  });
});

describe('hex input', () => {
  it('accepts six hex digits with or without #, in any case', () => {
    expect(normalizeHex('#F97316')).toBe('#f97316');
    expect(normalizeHex(' f97316 ')).toBe('#f97316');
  });

  it('rejects anything else', () => {
    expect(normalizeHex('#f9731')).toBeNull();
    expect(normalizeHex('#f973166')).toBeNull();
    expect(normalizeHex('orange')).toBeNull();
    expect(normalizeHex('')).toBeNull();
  });
});

describe('writes', () => {
  it('maps Classic to the server id and writes the preset font, without a brand colour', () => {
    const writes = draftWrites(BASE);
    expect(writes['appearance.theme']).toBe('classic');
    expect(writes['appearance.font']).toBe('plex');
    expect(writes).not.toHaveProperty('appearance.brandColor');
    expect(writes['appearance.mode']).toBe('light');
    expect(writes['appearance.memberModeSwitch']).toBe(true);
    expect(writes['appearance.personalThemes']).toBe(false);
  });

  it('writes a preset with the font it ships with', () => {
    const ocean = PRESETS.find((preset) => preset.id === 'ocean');
    const writes = draftWrites({ ...BASE, preset: 'ocean', font: 'geist' });
    expect(writes['appearance.theme']).toBe('ocean');
    expect(writes['appearance.font']).toBe(ocean?.font);
  });

  it('writes every builder input for Custom', () => {
    const writes = draftWrites({
      ...BASE,
      preset: 'custom',
      brand: '#0f766e',
      mode: 'dark',
      surfaces: 'tinted',
      font: 'inter',
      personalThemes: true,
    });
    expect(writes).toMatchObject({
      'appearance.theme': 'custom',
      'appearance.brandColor': '#0f766e',
      'appearance.mode': 'dark',
      'appearance.surfaces': 'tinted',
      'appearance.font': 'inter',
      'appearance.personalThemes': true,
    });
  });
});

describe('theme tiles and preview', () => {
  it('lists the eight presets, then Custom painted with the draft brand', () => {
    const options = themeOptions({ ...BASE, mode: 'dark' });
    expect(options).toHaveLength(9);
    expect(options[0]).toMatchObject({ id: 'light', name: 'Classic', mode: 'Light' });
    expect(options.find((option) => option.id === 'ocean')?.mode).toBe('Dark');
    expect(options[8]).toMatchObject({ id: 'custom', name: 'Custom', mode: 'Dark' });
    expect(options[8]?.colors.ac).toBe('#f97316');
  });

  it('labels the preview as the mock does', () => {
    expect(previewLabel({ ...BASE, preset: 'custom' })).toBe('Custom · #f97316 · light');
    expect(previewLabel({ ...BASE, preset: 'ocean' })).toBe('Ocean preset');
  });

  it('themes the preview by data-theme for a preset and by built tokens for Custom', () => {
    expect(themeScope({ ...BASE, preset: 'forest' })).toEqual({ 'data-theme': 'forest' });
    const scope = themeScope({ ...BASE, preset: 'custom', mode: 'dark' });
    expect(scope['data-theme']).toBeUndefined();
    expect(scope.style).toMatchObject({ '--ac': '#f97316', colorScheme: 'dark' });
  });

  it('only promises a personal light/dark choice while members may switch', () => {
    expect(appearanceDescription('Acme Labs', true)).toBe(
      'Sets the default look for everyone in Acme Labs. People can still choose light or dark for themselves in their profile.',
    );
    expect(appearanceDescription('Acme Labs', false)).toBe(
      'Sets the default look for everyone in Acme Labs.',
    );
  });
});
