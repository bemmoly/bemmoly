<!--
The title becomes the squash commit: Conventional Commits, imperative, lowercase subject,
at most 72 characters, no issue numbers (AGENTS.md §4 and §5). Keep it under ~400 lines.
-->

## What

<!-- The change in a few sentences. -->

## Why

<!-- The reason. Link the issue in the body as "Closes #123"; name the ADR if one applies. -->

## How it was tested

<!-- Commands you ran and what they showed. A red test is reported as red. -->

- [ ] `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`
- [ ] `pnpm test:integration` (anything touching the database, queue, realtime or search)
- [ ] `pnpm build && pnpm size && pnpm test:e2e` (new user flows have a Playwright test)

## Screenshots (UI changes)

<!--
Verified in a running browser, light and dark, at 1440×900 and 390×844. Put each screenshot
beside the matching drawing in the design review (docs/design/premium), or the mock where the
review draws nothing. Delete this section and the next if there is no UI.
-->

| Design | This change |
| ------ | ----------- |
|        |             |

## Design system (UI changes)

<!--
Every UI change follows docs/design/system (AGENTS.md, "Design system: always follow it").
The full list is docs/design/system/definition-of-done.md. Tick what holds; explain any line
that does not.
-->

- [ ] In the frame: `PageLayout` (`full` or `contained`), one scroll region, sticky header, no
      sideways scroll at 390px
- [ ] Tokens only: no literal colour or font size; no new colour, size, radius, shadow, icon or
      pattern unless this PR adds it to `docs/design/system` (with an ADR where it says so)
- [ ] Shared components reused, not redrawn; a new shared component has a story and a test
- [ ] Icons drawn with `Icon` or a glyph component, keys with `Kbd`; no glyph characters
- [ ] Interaction notes written (primary job, top actions, keys, states) in
      `docs/design/premium/interaction/`
- [ ] States designed: skeleton, empty with one action, error with Try again, no permission, phone
- [ ] Optimistic edits, Undo over confirm, URL keeps filters and the open item, focus returns
- [ ] Keyboard: top actions work without a mouse; icon buttons have tooltips with their keys
- [ ] Words: sentence case, verbs on buttons, errors say what to do next, competitor names only
      as import labels
- [ ] AI surfaces are lilac and render only with AI on (tested with AI off)
- [ ] Accessible: 4.5:1 text in light and dark, focus ring visible, controls named, motion behind
      `motion-safe:`, 32px targets (44px on touch)

## Checklist

- [ ] A `.changeset/` entry for user-visible changes (`pnpm changeset`), naming any schema or
      configuration change an admin should know about
- [ ] Schema changesets written, with `down` where reversible, `irreversible` or `slow` set
      where true, and compatible with the previous minor
- [ ] `apps/server/.env.example` updated for any new environment key
- [ ] Docs updated where behaviour changed; an ADR when a design decision changed
- [ ] No secrets in the diff; no rule in AGENTS.md or the lint config weakened
