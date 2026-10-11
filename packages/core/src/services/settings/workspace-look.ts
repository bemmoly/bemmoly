import type { WorkspaceLook } from '@bemmoly/shared';
import type { SettingsService } from '../../contracts/settings.ts';

/**
 * The workspace's name and look from its settings, for everyone signed in:
 * people without workspace.settings.manage still need them to theme the shell.
 */
export async function readWorkspaceLook(
  settings: SettingsService,
  /** The AI runtime's answer for this person; without it, a chosen provider means on. */
  aiEnabled?: () => Promise<boolean>,
): Promise<WorkspaceLook> {
  const [
    name,
    url,
    providerId,
    theme,
    brandColor,
    font,
    logoKey,
    mode,
    surfaces,
    members,
    personal,
  ] = await Promise.all([
    settings.get('workspace.name'),
    settings.get('workspace.url'),
    settings.get('ai.providerId'),
    settings.get('appearance.theme'),
    settings.get('appearance.brandColor'),
    settings.get('appearance.font'),
    settings.get('appearance.logoKey'),
    settings.get('appearance.mode'),
    settings.get('appearance.surfaces'),
    settings.get('appearance.memberModeSwitch'),
    settings.get('appearance.personalThemes'),
  ]);
  return {
    name,
    url,
    aiEnabled: aiEnabled ? await aiEnabled() : Boolean(providerId),
    appearance: {
      theme,
      brandColor,
      font,
      logoKey,
      mode,
      surfaces,
      memberModeSwitch: members,
      personalThemes: personal,
    },
  };
}
