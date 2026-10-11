# Iconography

Drawn, never typed. One icon set, a few purpose-drawn glyphs, and a lint rule that keeps
characters out.

## One icon set

`import { Icon, ICON_SIZE, ICON_NAMES, type IconName } from '@bemmoly/ui/icons'` · Story:
Foundations/Icons ([`icon.stories.tsx`](../../../packages/ui/src/icons/icon.stories.tsx))

```tsx
<Icon name="inbox" />                       // 16px, decorative
<Icon name="warning" size={ICON_SIZE.bar} /> // 18px in the sidebar and rail
<Icon name="search" label="Search" />        // carries a name when nothing else does
```

- **Lucide only**, behind the design system's names: `SHAPES` (product nouns: `board`,
  `backlog`, `doc`, `inbox`, `settings`, `import` (an import source's tile, never its vendor's
  logo), …), `GLYPHS` (the controls: `search`, `caret`, `chevron`, `close`, `more`, `check`, `plus`, `enter`, `external`, …), `KIT_ICONS` (`home`, `me`,
  `bell`, `layers`, `tag`, `warning`, `info`, `undo`, `snooze`, `sun`, `moon`, `monitor` (the
  three modes: Light, Dark, Match system), …) and, with #77,
  `EDITOR_ICONS` (`text`, `heading`, `highlight`, `strike`, `row-add`, `trash-can`, …).
- **Sizes** (`ICON_SIZE`): `inline` 16px in buttons, rows, menus and dropdown carets; `bar` 18px
  in the sidebar and rail; `small` 14px in small controls. Screens use only these three; a
  shared component may size an icon to its own control (the brand block's 11px caret).
- **Stroke** 1.75px at every size, absolute (it does not thicken when scaled). Set by `Icon`;
  never pass `strokeWidth`.
- **Colour** is the text colour around it (`currentColor`): `text-tx-3` at rest, `text-tx` or
  `text-acc` when current. Never a fill colour of its own, never a type or signal colour unless
  the icon is that signal (a `warning` in `amber`).
- **Decorative by default** (`aria-hidden`). Give `label` only to an icon that stands alone and
  is not inside a named control; an `IconButton` names itself.
- **No direct `lucide-react` imports** outside `packages/ui/src/icons` (and the marketing site's
  own set, `apps/site/src/lib/icons.ts`): add the icon there under a design-system name, so the
  set stays one set. Lint: `no-restricted-imports`.

## Purpose-drawn glyphs

Three ideas are too important for a generic icon. Each is an SVG drawn from the review, in
`packages/ui/src/components/glyphs` (see [components-work-docs.md](components-work-docs.md#typeglyph-priorityglyph-statusglyph)):

| Glyph           | Drawing                                                            | Colour                    |
| --------------- | ------------------------------------------------------------------ | ------------------------- |
| `TypeGlyph`     | A rounded tile at the logo's ~24% corner ratio with a white mark   | `type-*`, fixed           |
| `PriorityGlyph` | Three signal bars, inked by level; Urgent is a red mark            | `tx-2`, Urgent `red`      |
| `StatusGlyph`   | A circle that fills as work moves right                            | `todo`, `prog`, `done`    |

Also drawn, not typed: `Logo` (the brand files), `EntityTile` letters and icons, `Avatar`
initials, `Kbd` keys, and Docs' `PageIcon`.

## Keys are drawn by Kbd

`<Kbd keys="Mod+K" />` draws modifiers and arrows as icons: Command on Apple platforms and
"Ctrl" elsewhere, never a character a font may lack. Tooltips, menus, the palette and the
shortcuts overlay all use it.

## The ban on glyph characters

`bemmoly/no-glyph-characters` (in `tools/eslint-plugin`, on for `apps/web`, `packages/ui`,
`packages/core-web`, `packages/editor`, every `modules/*/web` and the site's `.astro` pages)
fails:

- JSX text containing an arrow, a technical symbol, a geometric shape or a dingbat:
  `← → ↑ ↓ ↗ ⌘ ⌥ ⏎ ■ ● ◆ ▲ ▾ ▮ ✓ ✕ ⚙ ◐`, outside `<Kbd>`;
- a string that is nothing but glyphs (`'✓'`, `'›'`, `'⌘K'`), except as a `keys` or
  `shortcut` value;
- a label that leads or trails with a bullet, chevron or plus (`'+ Add'`, `'Next ›'`).

Fine: prose punctuation (`·` as a separator, `…`, `›` inside a sentence such as "Settings ›
Modules"), and characters inside `Kbd`.

If you need an icon the set lacks, add it to `packages/ui/src/icons` with a story entry. Never
silence the rule with a disable comment.
