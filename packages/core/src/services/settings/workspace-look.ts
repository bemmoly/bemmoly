import type { CustomThemeRecord, WorkspaceLook } from '@bemmoly/shared';
import { FONT_IDS, type FontId } from '@bemmoly/ui/tokens';
import type { SettingsService } from '../../contracts/settings.ts';

const isFont = (id: string): id is FontId => (FONT_IDS as string[]).includes(id);

/**
 * The workspace's name and look from its settings, for everyone signed in:
 * people without workspace.settings.manage still need them to theme the shell.
 */
export async function readWorkspaceLook(
  settings: SettingsService,
  /** The AI runtime's answer for this person; without it, a chosen provider means on. */
  aiEnabled?: () => Promise<boolean>,
  /** The workspace's custom themes, read by the appearance service. */
  customThemes: CustomThemeRecord[] = [],
): Promise<WorkspaceLook> {
  const [name, url, providerId, theme, customThemeId, defaultMode, font, logoKey] =
    await Promise.all([
      settings.get('workspace.name'),
      settings.get('workspace.url'),
      settings.get('ai.providerId'),
      settings.get('appearance.theme'),
      settings.get('appearance.customThemeId'),
      settings.get('appearance.defaultMode'),
      settings.get('appearance.font'),
      settings.get('appearance.logoKey'),
    ]);
  const [brandColor, mode, surfaces, members] = await Promise.all([
    settings.get('appearance.brandColor'),
    settings.get('appearance.mode'),
    settings.get('appearance.surfaces'),
    settings.get('appearance.memberModeSwitch'),
  ]);
  return {
    name,
    url,
    aiEnabled: aiEnabled ? await aiEnabled() : Boolean(providerId),
    appearance: {
      theme,
      customThemeId,
      defaultMode,
      font: isFont(font) ? font : 'plex',
      logoKey,
      // Only a workspace admin sets the theme (ADR 0021); kept for the previous minor's clients.
      personalThemes: false,
      customThemes,
      brandColor,
      mode,
      surfaces,
      memberModeSwitch: members,
    },
  };
}
