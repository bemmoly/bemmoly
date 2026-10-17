# Bemmoly design system

This folder is the single source of truth for how Bemmoly looks, reads and behaves. Every UI
change follows it: the product (Work, Docs, Inbox, Home), Settings, the setup wizard, sign-in
and the marketing site. It is written for someone building a new screen tomorrow, so every rule
names a real token or import and can be checked in review.

Decided in [ADR 0016](../../adr/0016-design-system-is-canonical.md), which builds on
[ADR 0015](../../adr/0015-premium-visual-system.md).

## Where truth lives

1. **This folder states the rules.** What to use, when, and what fails review.
2. **`packages/ui` holds the values and the parts.** Tokens in `src/tokens/*.ts` (generated
   into `theme.css` and `tailwind.css`), components in `src/components`, icons in `src/icons`,
   the brand files in `assets/brand`. When this folder and the code disagree, the pull request
   that notices fixes one of them so they agree again; nobody picks a third value.
3. **Everything else is history and evidence** (see the end of this page). It explains why a
   rule exists. It never overrides one.

## Sections

| File                                                | What it settles                                                              |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| [principles.md](principles.md)                      | The four ideas every rule comes from                                         |
| [brand.md](brand.md)                                | Logo files, the lockup, the brand block, logo colours as the system          |
| [tokens.md](tokens.md)                              | Every canonical token: colour, type, radius, elevation, motion, focus        |
| [layout.md](layout.md)                              | The one frame, the two page layouts, scrolling, module sidebar contributions |
| [components.md](components.md)                      | Shared components: controls, overlays, feedback, data, states                |
| [components-work-docs.md](components-work-docs.md)  | The issue vocabulary and the Docs surfaces                                   |
| [iconography.md](iconography.md)                    | One icon set, the purpose-drawn glyphs, the glyph-character ban              |
| [interaction.md](interaction.md)                    | The twelve interaction rules, the shortcut map, notes every new screen needs |
| [content.md](content.md)                            | Words: sentence case, verbs, errors, names of other products                 |
| [ai.md](ai.md)                                      | AI surfaces: lilac, and only when AI is on                                   |
| [accessibility.md](accessibility.md)                | Contrast, focus, names, decorative glyphs, motion, targets                   |
| [marketing-site.md](marketing-site.md)              | bemmoly.com: same tokens and lockup, the three promises, honest claims       |
| [definition-of-done.md](definition-of-done.md)      | The checklist a UI change passes before review                               |
| [changing-the-system.md](changing-the-system.md)    | How a rule, token or component is added or changed                           |

## Building a new screen: the short version

1. Put it in the frame: `PageLayout` from `@bemmoly/core-web`, `full` or `contained`
   ([layout.md](layout.md)). Never draw your own header, sidebar or scroll container.
2. Write its interaction notes first ([interaction.md](interaction.md#notes-every-new-screen-needs)).
3. Build from `@bemmoly/ui` components ([components.md](components.md)). If an idea already has
   a component, use it; if it has none, add one to `packages/ui` with a story.
4. Colour, size, radius and shadow come from tokens only ([tokens.md](tokens.md)). Icons come
   from `Icon` or a glyph component ([iconography.md](iconography.md)).
5. Design every state: loading skeleton, empty, error, partial, many items, no permission.
6. Words in sentence case, verbs on buttons, errors that say what to do next ([content.md](content.md)).
7. Check it in a browser, light and dark, at 1440px and 390px, keyboard only.
8. Tick [definition-of-done.md](definition-of-done.md) in the pull request template.

## What fails review on sight

- A screen outside the frame: its own top bar, its own sidebar, a second scrollbar, no
  `PageLayout` (the setup wizard, the pre-sign-in pages and the MCP consent screen are the
  only standalone screens). Bemmoly Pipelines is a separate product with its own frame,
  `PipelinesShell` ([ADR 0037](../../adr/0037-pipelines-is-a-separate-product-with-its-own-shell.md),
  [../pipelines/](../pipelines/README.md)); its screens sit inside that frame instead.
- A glyph character standing in for an icon (`✓ ✕ ▾ → ⌘ • ›`), outside `Kbd`. Lint fails it.
- A literal colour (`#2356c9`, `rgb(…)`, `bg-[#…]`) or a literal font size (`text-[13px]`) in UI
  code. Lint fails it.
- A new colour, size, radius, shadow, icon or pattern that is not in this folder.
- A component redrawn in a page when `packages/ui` already has it.
- AI lilac on anything that is not AI output, or an AI surface shown while AI is off.
- Capitalised labels, "Submit" or "OK" buttons, or an error that does not say what to do next.

## Marked "with #77"

Rules and imports marked **(with #77)** describe the Docs redesign, which lands with pull
request #77 (`feat/premium-docs`). Until it merges, those files exist only on that branch.

## History and evidence

These explain how the rules were reached. Read them for the why; follow this folder for the what.

- [`../premium/`](../premium/README.md): the design review (Current and Proposed for every
  screen, `kit.css` and `kit.js` with the original drawings, `content.js` with every finding).
- [`../premium/interaction.md`](../premium/interaction.md) and
  [`../premium/interaction/`](../premium/interaction/): per-screen interaction notes and the
  choices each build stream recorded. New screens still add their notes there.
- `../premium/docs/` (with #77): the Docs review, and `interaction/docs-*.md`.
- The owner's build brief (agreed decisions and the twelve interaction principles) and the
  marketing-site review are folded into [principles.md](principles.md),
  [interaction.md](interaction.md) and [marketing-site.md](marketing-site.md); they are not in
  the repository.
- [`../mocks/`](../mocks/README.md): the first release's mocks. **Superseded** wherever this
  folder or the review covers a screen; they still hold only for the internals nothing newer
  draws (most settings page contents, setup steps).
- [`../README.md`](../README.md): the log of deviations from the mocks.
