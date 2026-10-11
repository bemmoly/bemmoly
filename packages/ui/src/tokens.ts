/**
 * The single source of truth for design tokens (`@bemmoly/ui/tokens`). Values come from the
 * design review (docs/design/premium/kit.css, ADR 0015). theme.css and tailwind.css are
 * generated from these modules; a test fails if they drift.
 */
export * from './tokens/names.ts';
export * from './tokens/fonts.ts';
export * from './tokens/metrics.ts';
export * from './tokens/motion.ts';
export * from './tokens/interaction.ts';
export * from './tokens/presets.ts';
export {
  AVATAR_COLORS,
  BRAND,
  ELEVATIONS,
  EPIC_COLORS,
  FIXED_COLOR_TOKENS,
  FIXED_COLORS,
  HUE_PAIRS,
  MODE_COLORS,
  SCRIM,
  TYPE_COLORS,
  type AvatarColor,
  type FixedColorToken,
  type TypeColorToken,
} from './tokens/semantic.ts';
export {
  accentFill,
  accentTints,
  DARK_ON_ACCENT,
  ON_ACCENT,
  resolveColors,
  resolvePreset,
  themeById,
  THEMES,
  withContrast,
  type ColorInputs,
  type ResolvedTheme,
} from './tokens/resolve.ts';
