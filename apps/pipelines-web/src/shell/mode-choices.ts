import type { IconName } from '@bemmoly/ui/icons';
import type { ModePreference } from '../hooks/use-mode.ts';

/** Light, Dark and Match system, in Bemmoly's order and with its icons. */
export const MODE_CHOICES: readonly {
  value: ModePreference;
  word: 'pipelines.settings.light' | 'pipelines.settings.dark' | 'pipelines.settings.system';
  icon: IconName;
}[] = [
  { value: 'light', word: 'pipelines.settings.light', icon: 'sun' },
  { value: 'dark', word: 'pipelines.settings.dark', icon: 'moon' },
  { value: 'system', word: 'pipelines.settings.system', icon: 'monitor' },
];
