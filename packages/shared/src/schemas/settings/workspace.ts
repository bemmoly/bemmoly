import { z } from 'zod';
import {
  modePreferenceSchema,
  surfaceToneSchema,
  themeFontSchema,
  themeModeSchema,
} from '../contracts/settings.ts';
import { customThemeSchema } from './themes.ts';

/**
 * The workspace's name and look, which everyone signed in sees whatever their
 * capabilities: returned with /me so the shell themes without reading the
 * admin settings API.
 */
export const workspaceLookSchema = z.object({
  name: z.string(),
  url: z.string(),
  /** An AI provider is chosen, so the shell offers "Ask Bemmoly". */
  aiEnabled: z.boolean(),
  appearance: z.object({
    /** A built-in theme id, or "custom" with customThemeId naming it. */
    theme: z.string(),
    customThemeId: z.uuid().nullable(),
    defaultMode: modePreferenceSchema,
    font: themeFontSchema,
    logoKey: z.string(),
    personalThemes: z.boolean(),
    /** The workspace's own custom themes, for the pickers and first paint. */
    customThemes: z.array(customThemeSchema),
    /** Retired with the presets; still sent so the previous minor's clients keep working. */
    brandColor: z.string(),
    mode: themeModeSchema,
    surfaces: surfaceToneSchema,
    memberModeSwitch: z.boolean(),
  }),
});

export type WorkspaceLook = z.infer<typeof workspaceLookSchema>;
