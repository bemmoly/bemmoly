import type { CustomThemeRecord, ModePreference } from '@bemmoly/shared';
import type { FontId } from '@bemmoly/ui/tokens';
import {
  appearanceFrom,
  appearanceWrites,
  type Appearance,
  type AppearanceKey,
} from '../lib/appearance.ts';
import {
  CUSTOM_PREFIX,
  sourceOf,
  workspaceRef,
  type LookPreview,
  type ThemeRef,
} from '../lib/theme.ts';
import type { SettingReads, SettingValues } from './use-setting.ts';

/** Everything Settings › Appearance edits for the workspace (ADR 0021). */
export interface AppearanceDraft {
  /** A built-in theme id, or `custom:<id>` for one of the workspace's custom themes. */
  theme: ThemeRef;
  defaultMode: ModePreference;
  font: FontId;
}

export function draftFrom(
  reads: SettingReads<AppearanceKey>,
  customThemes: CustomThemeRecord[],
): AppearanceDraft {
  const appearance = appearanceFrom(reads, customThemes);
  return {
    theme: workspaceRef(appearance),
    defaultMode: appearance.defaultMode,
    font: appearance.font,
  };
}

export function toAppearance(
  draft: AppearanceDraft,
  customThemes: CustomThemeRecord[],
): Appearance {
  const custom = draft.theme.startsWith(CUSTOM_PREFIX);
  return {
    theme: custom ? 'custom' : draft.theme,
    customThemeId: custom ? draft.theme.slice(CUSTOM_PREFIX.length) : null,
    defaultMode: draft.defaultMode,
    font: draft.font,
    logoKey: null,
    customThemes,
  };
}

/** The settings to write for the draft. */
export function draftWrites(
  draft: AppearanceDraft,
  customThemes: CustomThemeRecord[],
): SettingValues<AppearanceKey> {
  return Object.fromEntries(
    appearanceWrites(toAppearance(draft, customThemes)),
  ) as SettingValues<AppearanceKey>;
}

/** The draft as the whole page shows it while previewed: the theme and the typeface. */
export function draftPreview(
  draft: AppearanceDraft,
  customThemes: readonly CustomThemeRecord[],
): LookPreview {
  return { source: sourceOf(draft.theme, customThemes), font: draft.font };
}

/** "#F97316", " f97316 " and "#f97316" all mean the same brand; anything else is not a colour. */
export function normalizeHex(text: string): string | null {
  const trimmed = text.trim();
  const hex = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
}

export const HEX_ERROR = 'Use six hex digits, like #0f766e.';

export function appearanceDescription(workspaceName: string): string {
  return `The default look for everyone in ${workspaceName}. Each person can still pick Light, Dark or Match system for themselves.`;
}
