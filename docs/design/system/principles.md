# Principles

Four ideas. Every other rule in this folder is one of them applied. When a case is not covered,
choose the option that keeps all four, and record the choice (see
[changing-the-system.md](changing-the-system.md)).

The bar, in the owner's words: a product that could sell for crores, given away free.

## 1. Calm density

Show a lot, quietly. People live in Bemmoly all day; it should feel like a well-set page, not a
dashboard.

- One alignment grid per screen. No card inside a card, no border where spacing already
  separates.
- Text sits on three greys only (`tx`, `tx-2`, `tx-3`) and on three surfaces (`canvas`,
  `sunken`, `card`).
- Default UI text is 13px; reading text 14px; nothing under 11px.
- Rows are dense (28 to 36px) but every target is at least 32px, 44px on touch.
- Numbers are tabular (`tabular-nums`) wherever they line up or change.

Check: squint at the screenshot. If a border, a shadow or a colour can go without losing
meaning, it goes.

## 2. Colour only for meaning

Colour is spent on what a thing is or what state it is in, never on decoration.

- Each colour family has one job: type, status category, priority (Urgent only), epic, signal,
  AI, the accent for "you can act here or this is selected". See [tokens.md](tokens.md#colour).
- No family borrows another's colour: a type is never a status colour, an epic is never red,
  AI lilac is never a brand flourish.
- Large areas stay neutral. A screen with no selection and no problem is mostly grey on white
  (or on `#111418` in dark).

Check: for every coloured pixel, name its meaning. "It looked nice" is not one.

## 3. One component per idea

The same idea looks and behaves the same everywhere.

- One `IssueCard`, one `IssueRow`, one `FilterBar`, one `PageHeader`, one `EntityTile`, one
  table style, one `Modal`, one menu, one toast. Board and Backlog are two views of the same
  data and look it.
- A page never redraws a shared component. It composes them, or adds a variant to the shared
  component with a story.
- A new idea gets a new component in `packages/ui` (or `@bemmoly/core-web` for shell parts),
  with a story, before a second screen needs it.

Check: search `packages/ui/src/components` before writing markup. If two screens draw the same
thing two ways, one of them is wrong.

## 4. Drawn, not typed

Every icon, glyph and key hint is drawn, so it looks identical on every operating system.

- Icons are `Icon` (Lucide, 16px, stroke 1.75); type, priority and status are purpose-drawn SVG
  glyphs; keys are `Kbd`. See [iconography.md](iconography.md).
- No Unicode arrows, shapes, ticks, crosses, bullets or modifier symbols in UI text. The
  `bemmoly/no-glyph-characters` lint rule fails them.
- The logo is the brand files in `packages/ui/assets/brand`, inlined by `Logo`; nothing redraws
  it.

Check: `pnpm lint` passes, and no screenshot shows a font fallback square or a mismatched arrow.

## Agreed decisions these rest on

Settled by the owner on 2026-10-10 and not reopened without an ADR:

- One frame on every screen: 240px sidebar, 52px header, then content; no global top bar.
- Two page layouts only, `full` and `contained`; one scroll region per page; sticky headers.
- One workspace per install, so never a workspace switcher.
- Bemmoly always holds the sidebar's top-left; custom themes never recolour the mark.
- The logo's colours are the system: `#2356C9` accent and Work, `#5B7BE5` Docs and the dark
  accent, `#9A85EA` AI only. Epics have their own violet `#6E56CF`.
- Icons are drawn, never typed.
- A token diet: 3 text greys, 2 lines, 3 surfaces, 7 type sizes, 4 radii and full, 3 elevations.
- Modules draw into the same sidebar through their manifest (`icon`, `color`, `sidebar`).
