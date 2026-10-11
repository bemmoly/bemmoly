# Definition of done for UI

A UI change is done when every line below is true. The pull request template carries the short
form; reviewers name the line they are applying. This adds to AGENTS.md §7, it does not replace
it.

## Frame and layout

- [ ] The screen sits in the frame through `PageLayout` (`full` or `contained`), or is one of the
      recorded standalone screens (setup wizard, pre-sign-in pages, MCP consent).
- [ ] One scroll region, owned by the layout; the header sticks; nothing scrolls sideways at 390px.
- [ ] Page actions are in the header (`HeaderActions`); view tabs are `PageHeader` `tabs`.
- [ ] The tab title reads "page · context · Bemmoly".

## Tokens, components, icons

- [ ] Colour, type size, radius, elevation and motion come from tokens only. `pnpm lint` passes
      `bemmoly/no-literal-styles`.
- [ ] Every shared idea uses its `@bemmoly/ui` or `@bemmoly/core-web` component; nothing is
      redrawn in a page.
- [ ] A new shared component or variant has a story, a test with `expectAccessible`, and an entry
      in [components.md](components.md) or [components-work-docs.md](components-work-docs.md).
- [ ] Icons are `Icon` or a glyph component; keys are `Kbd`. `pnpm lint` passes
      `bemmoly/no-glyph-characters` and the Lucide import ban.
- [ ] No new colour, size, icon or pattern outside this folder (or the same PR adds it here, per
      [changing-the-system.md](changing-the-system.md)).

## Behaviour

- [ ] Interaction notes exist for the screen (primary job, top three actions, keys, states, URL
      state, choices) in `docs/design/premium/interaction/`.
- [ ] Small edits happen in place; mutations are optimistic with rollback; buttons show progress.
- [ ] Reversible destructive actions use Undo, not a confirmation.
- [ ] URL holds filters, view and the open item; Back, Forward and reload restore them; closing
      an overlay returns focus.
- [ ] The top three actions work with the keyboard alone; every icon button has a tooltip with
      its key; new keys are in the `?` overlay and do not fire while typing.
- [ ] Hover actions also appear on keyboard focus and on touch.

## States

- [ ] Loading is a skeleton of the final layout; nothing shifts when data lands.
- [ ] Empty has one primary action; a filtered empty offers "Clear filters".
- [ ] Error says what happened and what to do next, with Try again, inside the frame.
- [ ] Partial, many items (hundreds), no permission and phone are designed and checked.

## Words and AI

- [ ] Sentence case, verbs on buttons, no capitalised labels, errors that say what to do next.
- [ ] Competitor names only as import labels.
- [ ] AI surfaces are lilac, render only with AI on, and have a test with AI off.

## Accessibility

- [ ] Text at least 4.5:1 in light and dark; meaningful graphics at least 3:1.
- [ ] Focus ring visible on every interactive element; focus order follows reading order.
- [ ] Every control has a name; decorative glyphs are hidden; colour is never the only signal.
- [ ] Motion is behind `motion-safe:`; targets are 32px (44px on touch).

## Verified

- [ ] Checked in a running browser, light and dark, at 1440×900 and 390×844, with screenshots in
      the PR beside the matching review drawing (or the mock where the review draws nothing).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and the touched packages' tests pass;
      `pnpm --filter @bemmoly/ui build` passes when a story changed.
