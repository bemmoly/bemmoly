# ADR 0034: Avatar amber is darkened to carry white initials at 4.5:1

- Status: accepted
- Date: 2026-10-11
- Changes: the `avatar-amber` value in `packages/ui/src/tokens/semantic.ts` (ADR 0021 keeps
  avatar colours fixed per mode, never per theme; this changes the one value, not that rule)
- Evidence: the WCAG 2.2 AA audit (`apps/web/e2e/a11y/screens.spec.ts`,
  `docs/accessibility-conformance.md`): axe `color-contrast` on every screen that draws an
  amber avatar, in all five themes and both modes

## Context

[tokens.md](../design/system/tokens.md#avatar-hues-fixed) promises that every avatar hue carries
white initials at 4.5:1, and the comment on `AVATAR_COLORS` says each was "darkened the least
that carries white initials at 4.5:1". Amber, `#a36c1b`, gives 4.45:1. The audit found it on the
sign-in pages (the board preview beside the form) and on every screen that shows a person who
draws amber, in every theme, because the avatar colours do not change with the theme. Nothing
tested the promise: `tokens.test.ts` held the theme text tokens to 4.5:1 but not the avatar
fills.

## Decision

1. **`avatar-amber` becomes `#a06a1a`**, 4.59:1 with white: the least darkening of the same hue
   that clears 4.5:1, as the other five were made.
2. **`tokens.test.ts` holds every avatar colour to 4.5:1 with white**, so the promise in
   tokens.md is checked, not only written.

## Consequences

- Amber avatars are a shade darker on every screen and in every theme; the hue is unchanged and
  still reads as amber beside orange and green. Nothing else uses the token.
- The generated `styles/base.css` changes with it (`pnpm --filter @bemmoly/ui tokens:css`).

## Alternatives

- **Dark initials on amber.** Breaks the rule that avatar fills carry `on-solid` white, and
  would make amber the one avatar that looks different.
- **Bold initials.** At the avatar's 8 to 11px the initials are not "large text", so weight does
  not lower the 4.5:1 requirement.
