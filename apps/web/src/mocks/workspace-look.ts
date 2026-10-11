import type { CustomThemeRecord, WorkspaceLook } from '@bemmoly/shared';
import { FONT_IDS, type FontId } from '@bemmoly/ui/tokens';
import type { MockDb } from './db.ts';
import { aiEnabledFor } from './routes/ai-state.ts';

const MODES = ['light', 'dark', 'system'] as const;

/** What /me carries as `workspace`, from the mock's settings with the kernel's defaults. */
export function workspaceLookOf(db: MockDb): WorkspaceLook {
  const settings = db.settings as Record<string, unknown>;
  const text = (key: string, fallback: string) => {
    const value = settings[key];
    return typeof value === 'string' ? value : fallback;
  };
  const font = text('appearance.font', 'plex');
  const customThemeId = settings['appearance.customThemeId'];
  return {
    name: text('workspace.name', 'Bemmoly'),
    url: text('workspace.url', ''),
    aiEnabled: aiEnabledFor(db, db.signedInAs),
    appearance: {
      theme: text('appearance.theme', 'bemmoly'),
      customThemeId: typeof customThemeId === 'string' ? customThemeId : null,
      defaultMode: MODES.find((mode) => mode === settings['appearance.defaultMode']) ?? 'system',
      font: (FONT_IDS as string[]).includes(font) ? (font as FontId) : 'plex',
      logoKey: text('appearance.logoKey', ''),
      personalThemes: settings['appearance.personalThemes'] === true,
      customThemes: workspaceThemesOf(db),
      brandColor: text('appearance.brandColor', '#2356c9'),
      mode: settings['appearance.mode'] === 'dark' ? 'dark' : 'light',
      surfaces: settings['appearance.surfaces'] === 'tinted' ? 'tinted' : 'neutral',
      memberModeSwitch: settings['appearance.memberModeSwitch'] !== false,
    },
  };
}

/** The workspace's custom themes in the mock. */
export function workspaceThemesOf(db: MockDb): CustomThemeRecord[] {
  return db.customThemes.filter((theme) => theme.scope === 'workspace');
}

/** setup.completedAt, as setup status reports it. */
export function completedAtOf(db: MockDb): string | null {
  const value = (db.settings as Record<string, unknown>)['setup.completedAt'];
  return typeof value === 'string' ? value : null;
}
