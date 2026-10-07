import { z } from 'zod';
import { surfaceToneSchema, themeModeSchema } from '../contracts/settings.ts';

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
    /** A preset id ("classic", …) or "custom". */
    theme: z.string(),
    brandColor: z.string(),
    font: z.string(),
    logoKey: z.string(),
    mode: themeModeSchema,
    surfaces: surfaceToneSchema,
    memberModeSwitch: z.boolean(),
    personalThemes: z.boolean(),
  }),
});

export type WorkspaceLook = z.infer<typeof workspaceLookSchema>;
