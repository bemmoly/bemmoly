/** Typefaces from the theme table of the Board mock, self-hosted (see fonts.css). */

const SYSTEM_SANS =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const FONTS = {
  plex: { name: 'IBM Plex Sans', stack: `'IBM Plex Sans', ${SYSTEM_SANS}` },
  inter: { name: 'Inter Tight', stack: `'Inter Tight', 'IBM Plex Sans', ${SYSTEM_SANS}` },
  source: { name: 'Source Sans 3', stack: `'Source Sans 3', 'IBM Plex Sans', ${SYSTEM_SANS}` },
  geist: { name: 'Geist', stack: `'Geist', 'IBM Plex Sans', ${SYSTEM_SANS}` },
} as const;

export type FontId = keyof typeof FONTS;

export const FONT_IDS = Object.keys(FONTS) as FontId[];

export const MONO_STACK =
  "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
