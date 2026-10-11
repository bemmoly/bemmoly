import type { CustomThemeRecord, ModePreference } from '@bemmoly/shared';
import { customThemeSource } from '@bemmoly/ui/theme';
import {
  DEFAULT_THEME,
  isThemeId,
  RETIRED_PRESETS,
  themeSource,
  type FontId,
  type ThemeMode,
  type ThemeSource,
} from '@bemmoly/ui/tokens';
import type { Appearance } from './appearance.ts';

/** A theme someone can pick: a built-in id, or `custom:<id>` for a saved custom theme. */
export type ThemeRef = string;

export const CUSTOM_PREFIX = 'custom:';

export const customRef = (id: string): ThemeRef => `${CUSTOM_PREFIX}${id}`;

/** A person's own choice; null means the workspace's. Stored on their account (ADR 0021). */
export interface PersonalAppearance {
  mode: ModePreference | null;
  theme: ThemeRef | null;
}

export const NO_PERSONAL_APPEARANCE: PersonalAppearance = { mode: null, theme: null };

/** What a page is trying on before it is saved: any part of the look. */
export interface LookPreview {
  source?: ThemeSource;
  mode?: ModePreference;
  font?: FontId;
}

/** The look to paint: one theme in one mode, with the typeface beside it. */
export interface Look {
  source: ThemeSource;
  /** Whether the theme is a custom one, applied as inline tokens. */
  custom: boolean;
  /** The choice, which may be "system"… */
  preference: ModePreference;
  /** …and what it comes to on this device right now. */
  mode: ThemeMode;
  font: FontId;
}

/** A retired preset id (old device caches, old links) as the theme it became. */
export function normalizeThemeRef(ref: string | null | undefined): ThemeRef | null {
  if (!ref) return null;
  if (ref.startsWith(CUSTOM_PREFIX) || isThemeId(ref)) return ref;
  return RETIRED_PRESETS[ref]?.theme ?? null;
}

/** The workspace's chosen theme as a reference. */
export function workspaceRef(appearance: Appearance): ThemeRef {
  if (appearance.theme === 'custom' && appearance.customThemeId)
    return customRef(appearance.customThemeId);
  return normalizeThemeRef(appearance.theme) ?? DEFAULT_THEME;
}

/** The source a reference names among the themes this person can see; Bemmoly when gone. */
export function sourceOf(ref: ThemeRef, customThemes: readonly CustomThemeRecord[]): ThemeSource {
  if (!ref.startsWith(CUSTOM_PREFIX)) return themeSource(ref);
  const id = ref.slice(CUSTOM_PREFIX.length);
  const record = customThemes.find((theme) => theme.id === id);
  if (!record) return themeSource(DEFAULT_THEME);
  return customThemeSource(id, record.name, { brand: record.brandColor, surface: record.surface });
}

export interface LookInputs {
  /** The workspace look; undefined before sign-in (login, setup). */
  appearance: Appearance | undefined;
  personal: PersonalAppearance;
  /** Every custom theme this person can see: the workspace's and their own. */
  customThemes: readonly CustomThemeRecord[];
  preview?: LookPreview | null;
  /** The device prefers dark right now (matchMedia). */
  systemDark: boolean;
}

/**
 * Resolution, once for the theme and once for the mode: preview, then the person (their mode
 * always; their theme only while the workspace allows it), then the workspace, then Bemmoly
 * following the device.
 */
export function resolveLook(inputs: LookInputs): Look {
  const { appearance, personal, customThemes, preview, systemDark } = inputs;
  const allowed = appearance ? appearance.personalThemes : true;
  const personalRef = allowed ? normalizeThemeRef(personal.theme) : null;
  const ref = personalRef ?? (appearance ? workspaceRef(appearance) : DEFAULT_THEME);
  const source = preview?.source ?? sourceOf(ref, customThemes);
  const preference = preview?.mode ?? personal.mode ?? appearance?.defaultMode ?? 'system';
  const mode: ThemeMode = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  return {
    source,
    custom: !isThemeId(source.id),
    preference,
    mode,
    font: preview?.font ?? appearance?.font ?? 'plex',
  };
}
