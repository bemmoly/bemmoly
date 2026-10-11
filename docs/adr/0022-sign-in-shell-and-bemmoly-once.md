# ADR 0022: The sign-in shell, and Bemmoly appears once

- Status: accepted
- Date: 2026-10-11
- Changes: rule 5 of [brand.md](../design/system/brand.md) (where the name lives before sign-in)
- Evidence: the sign-in review (`docs/design-review/bemmoly-signin-review.html`, source in
  `docs/design-review/signin-source/`), approved by the owner with every default

## Context

The pages before sign-in (sign-in, single sign-on, password reset, invitations, the first
sign-in) were a small card on an empty canvas. The card led with the workspace's initial tile
and put "Powered by Bemmoly" under it, so a workspace without a logo showed two marks and the
Bemmoly name twice. The review measured the rest: errors in one red box whatever went wrong, a
2:1 loading button, no remembered method, the workspace theme ignored until after sign-in.

## Decision

1. **Bemmoly appears exactly once on every page before sign-in.** Without a custom logo the
   Bemmoly lockup leads at the top-left; there is no initial tile and no "Powered by", and the
   workspace name goes in the heading ("Sign in to Acme Labs"). With a custom logo the
   customer's logo and name lead, and "Powered by Bemmoly" with the mark sits at the foot. The
   foot otherwise shows only the lock and the host.
2. **One shell, `AuthShell`.** A form column (480px under 1300px wide, 520px above) and, from
   1100px, a product panel: a still life of a board, an issue peek, a doc with a collaborator's
   cursor, an AI summary marked "Example" and the ⌘K chip, in the workspace's theme, with fixed
   sample text and hidden from assistive tech. One column below 1100px; full-bleed on phones,
   with 46px controls and 16px text (`size="touch"`).
3. **The panel drifts.** A new motion token, `drift`, floats each card a few pixels and back
   over about 13 seconds. It is ambient only, behind `motion-safe:`, and stops under reduced
   motion. Nothing a person reads or uses ever drifts.
4. **The workspace look before sign-in.** `GET /setup/status` adds the built-in theme and the
   default mode (already visible to anyone who signs in, naming no person or project), and the
   pages paint them. A custom theme's colours stay behind sign-in.

## Consequences

- `brand.md` rule 5 says the above; the `AuthShell` and the panel are the only frame for these
  pages, and the setup wizard keeps its own header (no workspace exists yet there).
- The AI card in the panel is an illustration, labelled "Example", shown whether or not AI is
  on: before sign-in the page cannot know, and the card promises nothing about this workspace.
- Two-step verification is designed in the review but not built. It needs identity tables (TOTP
  secrets, recovery codes, trusted browsers) and its own ADR before any code.

## Alternatives

- **Keep the centred card.** Rejected: the empty canvas was the review's weakest score, and
  the card cannot carry the product glimpse.
- **Plain brand tiles or an uploaded image in the panel.** Kept for later; never a stock photo
  or a slogan.
- **"Powered by" on every workspace.** Rejected: with no custom logo it repeats the lockup.
