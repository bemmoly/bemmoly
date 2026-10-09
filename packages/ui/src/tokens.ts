/**
 * The single source of truth for design tokens (`@bemmoly/ui/tokens`). Values are copied
 * from the mocks in docs/design/mocks: neutral scales, accent triplets and fonts per preset
 * from the theme table of the Board mock, the Classic accent tints from that mock's :root
 * block, and the preset list from the Setup and Appearance Settings mocks. theme.css and
 * tailwind.css are generated from these modules; a test fails if they drift.
 */
export * from './tokens/names.ts';
export * from './tokens/fonts.ts';
export * from './tokens/metrics.ts';
export * from './tokens/motion.ts';
export * from './tokens/presets.ts';
export { HUE_PAIRS, PAIRS, SCRIM, SIGNAL_SOLIDS } from './tokens/semantic.ts';
export {
  accentTints,
  ON_ACCENT,
  resolveColors,
  resolvePreset,
  themeById,
  THEMES,
  type ColorInputs,
  type ResolvedTheme,
} from './tokens/resolve.ts';
