import type { CustomThemeRecord, SettingKey } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { APPEARANCE_KEYS, type AppearanceKey } from '../lib/appearance.ts';
import {
  appearanceDescription,
  draftFrom,
  draftPreview,
  draftWrites,
  normalizeHex,
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

const ACME: CustomThemeRecord = {
  id: '0199c0de-0000-7000-8000-00000000a001',
  name: 'Acme',
  brandColor: '#0f766e',
  surface: 'neutral',
  scope: 'workspace',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const BASE: AppearanceDraft = {
  theme: 'bemmoly',
  defaultMode: 'system',
  font: 'plex',
  personalThemes: false,
};

describe('appearance draft', () => {
  it('starts new workspaces on Bemmoly following the device', () => {
    expect(draftFrom(readsOf({}), [])).toEqual(BASE);
  });

  it('reads a retired preset as its theme and keeps the font apart', () => {
    const draft = draftFrom(
      readsOf({ 'appearance.theme': 'warm', 'appearance.font': 'source' }),
      [],
    );
    expect(draft).toMatchObject({ theme: 'sand', font: 'source' });
  });

  it('reads a custom default as a reference to that theme', () => {
    const draft = draftFrom(
      readsOf({ 'appearance.theme': 'custom', 'appearance.customThemeId': ACME.id }),
      [ACME],
    );
    expect(draft.theme).toBe(`custom:${ACME.id}`);
    expect(draftPreview(draft, [ACME]).source?.name).toBe('Acme');
  });

  it('writes a built-in theme with no custom id, and a custom one with its mirrored brand', () => {
    expect(draftWrites({ ...BASE, theme: 'pine', defaultMode: 'dark' }, [ACME])).toEqual({
      'appearance.theme': 'pine',
      'appearance.customThemeId': null,
      'appearance.defaultMode': 'dark',
      'appearance.font': 'plex',
      'appearance.personalThemes': false,
    });
    expect(draftWrites({ ...BASE, theme: `custom:${ACME.id}` }, [ACME])).toMatchObject({
      'appearance.theme': 'custom',
      'appearance.customThemeId': ACME.id,
      'appearance.brandColor': '#0f766e',
    });
  });

  it('falls back to Bemmoly when the custom default is gone', () => {
    expect(draftWrites({ ...BASE, theme: `custom:${ACME.id}` }, [])).toMatchObject({
      'appearance.theme': 'bemmoly',
      'appearance.customThemeId': null,
    });
  });

  it('accepts a hex with or without # in any case, and nothing else', () => {
    expect(normalizeHex(' F97316 ')).toBe('#f97316');
    expect(normalizeHex('#0F766E')).toBe('#0f766e');
    expect(normalizeHex('#12')).toBeNull();
    expect(normalizeHex('orange')).toBeNull();
  });

  it('says mode stays personal', () => {
    expect(appearanceDescription('Acme Labs')).toBe(
      'The default look for everyone in Acme Labs. Each person can still pick Light, Dark or Match system for themselves.',
    );
  });
});
