import type { WorkspaceLook } from '@bemmoly/shared';
import type { MockDb } from './db.ts';

/** What /me carries as `workspace`, from the mock's settings with the kernel's defaults. */
export function workspaceLookOf(db: MockDb): WorkspaceLook {
  const settings = db.settings as Record<string, unknown>;
  const text = (key: string, fallback: string) => {
    const value = settings[key];
    return typeof value === 'string' ? value : fallback;
  };
  return {
    name: text('workspace.name', 'Bemmoly'),
    url: text('workspace.url', ''),
    aiEnabled: Boolean(settings['ai.providerId']),
    appearance: {
      theme: text('appearance.theme', 'classic'),
      brandColor: text('appearance.brandColor', '#2356c9'),
      font: text('appearance.font', 'plex'),
      logoKey: text('appearance.logoKey', ''),
      mode: settings['appearance.mode'] === 'dark' ? 'dark' : 'light',
      surfaces: settings['appearance.surfaces'] === 'tinted' ? 'tinted' : 'neutral',
      memberModeSwitch: settings['appearance.memberModeSwitch'] !== false,
      personalThemes: settings['appearance.personalThemes'] === true,
    },
  };
}

/** setup.completedAt, as setup status reports it. */
export function completedAtOf(db: MockDb): string | null {
  const value = (db.settings as Record<string, unknown>)['setup.completedAt'];
  return typeof value === 'string' ? value : null;
}
