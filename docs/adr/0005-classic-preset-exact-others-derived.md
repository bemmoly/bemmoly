# ADR 0005: Classic uses the mock's exact colours; other presets derive tints with color-mix

- Status: accepted
- Date: 2026-10-07
- Tech design: [§2 Product scope](../tech-design.html#scope) (Appearance), [§6 Repository](../tech-design.html#repo) (`packages/ui`)

## Context

The mocks are the pixel source of truth. The Board mock's `:root` block spells out every
Classic colour, including five accent tints (`ac-bg`, `ac-bg2`, `ac-br`, `ac-av`, `ac-mute`).
Its theme table gives the other presets only an accent triplet, neutrals and a font, and
derives their tints in CSS from the accent and the surface. Workspace admins can also build a
custom theme from one brand colour, which has no hand-picked tints at all.

## Decision

1. The Classic preset (`light`) stores the five tints as the exact hex values from the mock.
2. Every other preset, and every custom theme, computes its tints with
   `color-mix(in oklab, <accent> <n>%, <base>)`, using the mock's percentages (lighter mixes on
   white for light themes, stronger mixes on the surface colour for dark ones).
3. Both paths go through `resolvePreset` in `packages/ui/src/tokens.ts`, which generates
   `theme.css`. Components only ever read the resulting CSS variables.

## Consequences

- The default theme matches the mock to the hex, which is what screenshot tests compare.
- Presets and custom themes stay consistent with each other and need no hand-tuned table;
  adding a preset is an accent triplet, neutrals and a font.
- Derived tints depend on `color-mix` support, which every browser the product targets has.
  A derived tint can differ by a rounding step from a hand-picked one; that is accepted
  outside Classic.
- Changing the derivation changes every non-Classic theme at once, so it is a design change
  and goes through an ADR.

## Alternatives considered

- **Derive Classic too.** Simpler code, but Classic would drift from the mock by small amounts
  in every screenshot.
- **Hand-pick tints for every preset.** Eight tables to maintain and no answer for custom themes.
