import type { CustomThemeRecord } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, type Appearance } from '../lib/appearance.ts';
import { NO_PERSONAL_APPEARANCE, normalizeThemeRef, resolveLook } from '../lib/theme.ts';
import { migrateDeviceTheme, useThemeStore } from './theme.ts';

const workspace = (patch: Partial<Appearance> = {}): Appearance => ({
  ...DEFAULT_APPEARANCE,
  theme: 'sand',
  defaultMode: 'light',
  ...patch,
});

const acme: CustomThemeRecord = {
  id: '0199c0de-0000-7000-8000-00000000a001',
  name: 'Acme',
  brandColor: '#0f766e',
  surface: 'warm',
  scope: 'workspace',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const look = (inputs: Partial<Parameters<typeof resolveLook>[0]>) =>
  resolveLook({
    appearance: undefined,
    personal: NO_PERSONAL_APPEARANCE,
    customThemes: [],
    systemDark: false,
    ...inputs,
  });

describe('resolveLook', () => {
  it('is Bemmoly following the device before a workspace look exists', () => {
    expect(useThemeStore.getInitialState()).toMatchObject({ mode: null, theme: null });
    expect(look({})).toMatchObject({ preference: 'system', mode: 'light', font: 'plex' });
    expect(look({}).source.id).toBe('bemmoly');
    expect(look({ systemDark: true }).mode).toBe('dark');
  });

  it('uses the workspace theme and default mode, and the person’s own mode always', () => {
    const base = look({ appearance: workspace() });
    expect(base.source.id).toBe('sand');
    expect(base.mode).toBe('light');
    const own = look({ appearance: workspace(), personal: { mode: 'system', theme: null } });
    expect(own).toMatchObject({ preference: 'system', mode: 'light' });
    expect(look({ appearance: workspace(), personal: { mode: 'dark', theme: null } }).mode).toBe(
      'dark',
    );
  });

  it('honours a personal theme only while the workspace allows it', () => {
    const personal = { mode: null, theme: 'pine' };
    expect(look({ appearance: workspace(), personal }).source.id).toBe('sand');
    expect(look({ appearance: workspace({ personalThemes: true }), personal }).source.id).toBe(
      'pine',
    );
  });

  it('resolves a custom workspace theme and falls back to Bemmoly when it is gone', () => {
    const appearance = workspace({ theme: 'custom', customThemeId: acme.id });
    const found = look({ appearance, customThemes: [acme] });
    expect(found).toMatchObject({ custom: true });
    expect(found.source.name).toBe('Acme');
    expect(found.source.light.canvas).toBe('#fffdf9');
    expect(look({ appearance }).source.id).toBe('bemmoly');
  });

  it('lets a preview win over everything', () => {
    const preview = { mode: 'dark' as const, font: 'geist' as const };
    expect(look({ appearance: workspace(), preview })).toMatchObject({
      mode: 'dark',
      font: 'geist',
    });
  });
});

describe('the device cache', () => {
  it('maps the old per-device presets to a theme in their old mode', () => {
    expect(migrateDeviceTheme({ mode: 'system', preset: null })).toEqual({
      mode: null,
      theme: null,
    });
    expect(migrateDeviceTheme({ mode: 'system', preset: 'ocean' })).toEqual({
      mode: 'dark',
      theme: 'bemmoly',
    });
    expect(migrateDeviceTheme({ mode: 'light', preset: 'forest' })).toEqual({
      mode: 'light',
      theme: 'pine',
    });
  });

  it('reads retired ids in links and caches as their theme', () => {
    expect(normalizeThemeRef('warm')).toBe('sand');
    expect(normalizeThemeRef('graphite')).toBe('graphite');
    expect(normalizeThemeRef(`custom:${acme.id}`)).toBe(`custom:${acme.id}`);
    expect(normalizeThemeRef('nope')).toBeNull();
  });
});
