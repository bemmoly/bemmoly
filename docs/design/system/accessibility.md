# Accessibility

Accessible is part of premium. Every rule here is checkable with a keyboard, a screen reader or
a test.

## Contrast

- **Text is at least 4.5:1** on the surface it sits on, in every preset and in dark mode. The
  three text greys and every `-tx` signal ink are held to it by `tokens.test.ts`; stay on them
  and you pass.
- **Graphics that carry meaning are at least 3:1**: status glyphs, priority bars, focus rings,
  input borders that are the only edge of a control.
- Never put text on a type, epic or avatar colour except `on-solid` white, which those families
  are tuned for. Never put `red`/`amber`/`green` solids behind text; use the `-tx` inks on `-50`.
- Placeholder text is `tx-3` and is never the only label.
- `tx-3` passes on the four surfaces, not on a tint laid over them. On a selected or active row
  (`acc-50`, the hover tint in dark mode) or an idle segment (`line-2`), muted text steps up to
  `tx-2` (`group-aria-selected:text-tx-2`).
- A link inside a sentence is underlined; colour alone does not set it apart (1.4.1). Links
  that stand alone (a nav row, a crumb, a button-like "Open") need no underline.

## Focus

- Every interactive element shows the one ring on keyboard focus: `focus-ring` (2px `acc`, 2px
  offset), `focus-ring-inset` inside clipped lists, `focus-ring-within` on field wrappers.
  Shared components already carry it; a custom interactive element must add it.
- Never `outline: none` without the ring. Never a ring on mouse click (`:focus-visible` only).
- Focus order follows reading order. Overlays trap focus while open and return it to the opener
  on close (`useDialog`, `Modal`, `Drawer`, `Menu` do this).
- After a delete with Undo, focus moves to the next item, never to the top of the page.

## Roles and names

- Every control has an accessible name: visible text, or `label` on `IconButton` and `Icon`.
- `aria-label` goes only on an element with a role: a status dot that stands alone is
  `role="img"` with its label.
- Every screen has one `h1`. Where the trail already names the screen
  (Backlog, Roadmap, Inbox) the `h1` is `sr-only`. Headings do not skip a level.
- The frame's first Tab stop is **Skip to content**, which moves focus to `main` past the
  sidebar.
- A row that holds its own controls (a check, a menu) is a `grid` row, not a listbox `option`:
  an option may not contain interactive content.
- Use the semantic element or the shared component that sets the role: `Menu` (`menu`,
  `menuitem`, `menuitemradio`, `menuitemcheckbox`), `Tabs` (`tablist`), `Modal` (native
  `<dialog>`), `Table`, `Select` (`listbox`), `Switch` (`switch`).
- The current crumb, nav row and tab carry `aria-current` or `aria-selected`; the sidebar does
  this through `SidebarRow`.
- Loading regions are `aria-busy`; toasts are announced (`role="status"`, errors `alert`).
- Times are `<time dateTime>` through `RelativeTime`.
- Keyboard shortcuts are exposed with `aria-keyshortcuts` (`ariaKeyShortcuts` from `@bemmoly/ui`).

## Decorative glyphs

- An icon or glyph beside text that says the same thing is decorative: `Icon` without `label`,
  `StatusGlyph decorative`, `Logo label=""`, `EntityTile` (decorative by default). It is read
  once, as the text.
- A glyph that stands alone carries the name: `StatusGlyph label="In review"`,
  `PriorityGlyph` (named by default), a type tile in a dense column.
- Colour is never the only signal: a status has its glyph shape and name, a refused drop has its
  reason in words, an error has text.

## Motion

- Every animation is behind `motion-safe:` (`rules.test.ts` fails a component that animates
  without it). Under `prefers-reduced-motion: reduce` the base stylesheet sets every duration
  to zero, and code that waits for an exit (`usePresence`) does not wait.
- Nothing flashes more than three times a second. No parallax, no autoplaying motion.
- The Docs typing fade is opacity only and instant with reduced motion.

## Touch targets

- At least 32 by 32px on pointer devices (`h-control` is 32px; rail buttons 36 by 32), at least
  44 by 44px on touch. Small visual controls (a 14px check, a 24px workspace line) extend their
  hit area without moving layout.
- **Never under 24 by 24px** (WCAG 2.2, 2.5.8), measured on the element itself, not a
  pseudo-element: a 10px close glyph sits in a `size-6` button with negative margins (`Label`),
  a text action under a comment is `min-h-6` with `-my-1` (`ActivityAction`). A control a view
  cannot change is `disabled`, not a 13px target that does nothing.
- Hover-only actions are always visible on touch (see [interaction.md](interaction.md#6-hover-reveals-never-hides)).
- Known debt: menu rows are about 33px on touch, under the 44px target.

## Testing

- Component tests run axe through `expectAccessible` and check the ring with `expectFocusRing`
  (`packages/ui/src/testing/a11y.ts`). New shared components get both.
- Colour contrast is checked in the browser (Storybook, the presets toolbar, light and dark),
  since jsdom computes no styles.
- **The WCAG 2.2 AA audit** (`apps/web/e2e/a11y/`, `pnpm --filter @bemmoly/web test:a11y`)
  runs every screen through axe with every rule on, colour contrast included, in the five
  themes, light and dark, at desktop and 390px, on the dev mock backend; plus the keyboard,
  focus, live-region, target and sign-in checks axe cannot make. CI runs it per theme
  (**Accessibility**) and any violation fails. A new screen adds itself to `a11y/screens.ts`.
- New user flows against a real server add a Playwright check where an a11y spec exists
  (`apps/e2e/flows/docs-a11y.spec.ts`).
- What is covered, the known exceptions and how to report a problem:
  [docs/accessibility-conformance.md](../../accessibility-conformance.md).
- Before review: complete the flow with the keyboard only, and once with VoiceOver or NVDA.
