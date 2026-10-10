# ADR 0015: The design review is the source of truth for the shell and the visual language

- Status: accepted
- Date: 2026-10-10
- Supersedes: [ADR 0005](0005-classic-preset-exact-others-derived.md) decision 1 (Classic's
  exact values now come from the review, not the Board mock)
- Tech design: [§2 Product scope](../tech-design.html#scope) (Appearance),
  [§6 Repository](../tech-design.html#repo) (`packages/ui`)

## Context

Bemmoly works but does not feel premium. A design review compared every screen as it is with a
proposed redesign; the owner approved the proposal on 2026-10-10 and asked to migrate the
product to it, module by module. The review is committed at
[`docs/design/premium/`](../design/premium/README.md): `kit.css` holds every proposed token and
component style, `kit.js` the icon, glyph, avatar, tile and brand-block drawings, and
`content.js` every finding in words. Its evidence, in short:

- Type and priority icons are Unicode characters (▮ ● ✓ ◆ ⇈ ⇊) that no bundled font contains,
  so every operating system draws them differently
  ([foundations, current](../design/premium/foundations.js), `foundCurrent`).
- Type colours borrow status and priority colours, and three presets make two types identical.
- The token scale is wider than any screen needs: seven text greys (the most used one, `tx5`,
  fails 4.5:1), seven borders, nineteen font sizes, eleven radii, five unrelated shadows.
- Epic colours come from three different palettes on Backlog, Board and Issue.
- The logo's lilac and mid blue are used nowhere, a second violet (`#8B5CF6`) competes with
  the lilac, and a custom theme repaints the mark.
- Navigation changes shape on every screen ([content.js](../design/premium/content.js),
  "Overview").

## Decision

1. **The review is the source of truth** for the shell (sidebar, header, page layouts) and the
   visual language (tokens, icons, glyphs, tiles, avatars, labels, the brand block). Where it
   and `docs/design/mocks` overlap, the review wins; the mocks still hold for what the review
   does not draw (the content of most settings pages, the setup wizard's steps, the docs
   editor's internals).
2. **The logo's colours are the system.** `#2356C9` (brand-1) is the accent and the Work module
   colour. `#5B7BE5` (brand-2) is the Docs module colour and the dark-mode accent. `#9A85EA`
   (brand-3) is AI and only AI. Epics get their own violet, `#6E56CF`; the old `--violet`
   (`#8B5CF6`) is removed. `--brand-1/2/3` are fixed tokens.
3. **Colour families with one job each**, none borrowing from another: type colours
   (`--type-epic/story/task/bug/subtask/incident`, fixed across presets), status categories
   (`--todo` grey, `--prog` blue, `--done` green, per mode), the epic palette (`--epic-1…8`, the
   colour stored on the epic, never the danger red), signal colours (`--red`, `--amber`,
   `--green`, each with a text-safe `-tx` ink and a `-50` background), avatar colours and AI
   lilac (`--ai`, `--ai-600` for text, `--ai-100`, `--ai-50`).
4. **A token diet.** Three text greys, every one at least 4.5:1 on every surface; two lines;
   three surfaces (`canvas`, `sunken`, `card`) plus the sidebar's `side` and the `hover` and
   `press` overlays; type sizes 11/12/13/14/16/20/24; radii 4/6/8/12 and full; elevations
   e1/e2/e3. The first release's names stay as aliases that resolve to the new values, so
   contrast is fixed everywhere at once; a later change removes them. Canonical names are the
   ones in `kit.css`.
5. **Icons are drawn, never typed.** One `Icon` component (Lucide, 16px, stroke 1.75) plus
   purpose-drawn SVG glyphs: issue type (a tile at the logo's ~24% corner ratio), priority
   (neutral signal bars; only Urgent is red) and status (a circle that fills as work moves
   right, coloured by category). A lint rule fails on glyph characters in JSX; keyboard hints
   are drawn by the `Kbd` component.
6. **One workspace per install** (the tech design's non-goal), so nothing draws a workspace
   switcher. The workspace name sits under the Bemmoly lockup and opens a workspace menu.
7. **Bemmoly holds the sidebar's top-left**: mark and wordmark on line one, the workspace name
   on line two. A custom logo, once uploads exist, takes line one and moves Bemmoly to "on
   Bemmoly" on line two, which cannot be switched off. On the collapsed rail the mark leads, or
   sits at the rail's foot under a custom logo. The name also stays on sign-in ("Powered by
   Bemmoly"), the favicon and tab title, the sidebar footer, email footers and the loading
   screen ([brand.js](../design/premium/brand.js), rules 1 to 6).
8. **Custom themes never recolour the mark.** The four tiles keep their colours on every
   preset and every custom theme.
9. **Interaction is part of the foundation**: one focus ring (2px accent, offset 2px, keyboard
   only), shared hover and press overlays, motion tokens (enter 120 to 180ms ease-out, exit
   about 100ms, instant under reduced motion), and the primitives later screens build on
   (tooltip with shortcut, toast with Undo, relative time, skeletons). They are recorded in
   [`interaction.md`](../design/premium/interaction.md).

## Consequences

- Every screen moves to the new values at once through the aliases; screens are then rebuilt
  on the review's components one stream at a time.
- Where a `kit.css` value fails the contrast the product promises, the token takes the smallest
  step that passes and says so in a comment (Classic `tx-3`, Dark `tx-3`, the todo grey,
  `ai-600`, the avatar colours, the dark accent's fill). The review's look is kept; its
  arithmetic is corrected.
- Presets other than Classic and Dark keep their accent and font and project their neutrals
  onto the reduced set; a test holds every preset to the contrast rules.
- The aliases are debt with an owner: `packages/ui/src/tokens/names.ts` (`COLOR_ALIASES`) and
  `metrics.ts` (`TYPE_ALIASES`, `RADIUS_ALIASES`) list every one for removal.
- `AGENTS.md`'s design-fidelity rule now points at the review first.

## Alternatives considered

- **Restyle screen by screen without an ADR.** Each screen would invent its own values again,
  which is how the scale grew to nineteen font sizes.
- **Rename every call site to the new tokens now.** Hundreds of files churned in one change
  with no visual gain over aliases; the aliases go when each screen is rebuilt.
- **Keep the kit values even where they fail contrast.** The review promises 4.5:1 for text;
  the values are the review's intent, the contrast rule is its requirement.
