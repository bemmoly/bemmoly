# Tokens

The canonical names, and nothing else. Values live in `packages/ui/src/tokens/*.ts`
(`@bemmoly/ui/tokens`); `theme.css` and `tailwind.css` are generated from them by
`pnpm --filter @bemmoly/ui tokens:css`, and a test fails if they drift. Values below are the
Bemmoly theme in light and dark; the other themes keep the same names (see
[Themes and modes](#themes-and-modes)).

## How to use a token

| Where                 | How                                                    | Example                                      |
| --------------------- | ------------------------------------------------------ | -------------------------------------------- |
| Class names           | Tailwind utilities generated from the tokens           | `bg-card text-13 text-tx-2 rounded-card shadow-e1` |
| SVG and inline styles | The CSS variable                                       | `fill="var(--acc)"`, `style={{ width }}`     |
| TypeScript            | `@bemmoly/ui/tokens`                                   | `MOTION_MS.exit`, `TIMING.toastMs`, `TYPE_COLORS` |

Rules:

- **No literal colours** in UI code: no hex, `rgb()`, `hsl()`, `oklch()`, and no arbitrary
  colour class (`bg-[#…]`). Lint: `bemmoly/no-literal-styles`.
- **No literal font sizes**: no `text-[13px]`. Lint: same rule.
- **No arbitrary radius or shadow in new code** (`rounded-[3px]`, `shadow-[…]`). A few older
  marks still carry them; they are debt, not precedent.
- **Spacing is the 4px grid**: Tailwind's scale with `--spacing: 4px` (`p-2` = 8px, `gap-3` =
  12px). Half steps (`py-0.75`) exist for optical alignment only.
- **Colour that is data** (a label's or team's stored colour, a theme's brand input) is passed as
  a value at run time and drawn by the component that owns it (`Label`, `EntityTile color`).

## Colour

### Surfaces and lines

| Token     | Classic   | Dark      | Use                                                        |
| --------- | --------- | --------- | ---------------------------------------------------------- |
| `canvas`  | `#ffffff` | `#111418` | The page under the header; the header itself               |
| `side`    | `#f7f8fa` | `#0c0f13` | The sidebar and the settings sidebar only                  |
| `sunken`  | `#f5f6f8` | `#0e1115` | Recessed areas: board columns, wells, read-only fields     |
| `card`    | `#ffffff` | `#181c22` | Cards, menus, dialogs, popovers                            |
| `hover`   | ink 4.5%  | white 5%  | Overlay on any surface under the pointer (`bg-hover`)      |
| `press`   | ink 7%    | white 8%  | Overlay while pressed or open (`bg-press`)                 |
| `line`    | `#e3e6ec` | `#2a2f38` | Borders: cards, inputs, the header rule                    |
| `line-2`  | `#eef0f3` | `#20242b` | Dividers inside a card, table row rules, quiet chips       |
| `scrim`   | `rgba(16,24,40,.45)` | same | Behind dialogs and sheets. Flat, never blurred       |

### Text

| Token  | Classic   | Dark      | Use                                                    |
| ------ | --------- | --------- | ------------------------------------------------------ |
| `tx`   | `#161b26` | `#e8ebf1` | Titles, primary text, values                           |
| `tx-2` | `#4b5264` | `#a8b0be` | Secondary text, labels, inactive tabs                  |
| `tx-3` | `#697181` | `#858c9a` | Meta: keys, timestamps, counts, placeholders, carets   |

Every one passes 4.5:1 on every surface of every preset (`tokens.test.ts`). There is no fourth
grey. A disabled control fades as a whole (`disabled:opacity-50`), never with a lighter grey.

### Accent

| Token      | Classic   | Dark      | Use                                                          |
| ---------- | --------- | --------- | ------------------------------------------------------------ |
| `acc`      | `#2356c9` | `#5e7ee6` | Accent text, icons, lines, the focus ring, links             |
| `acc-fill` | `#2356c9` | `#506ecf` | Fill behind on-accent text (primary button, selected chip)   |
| `on-acc`   | `#fff`    | `#fff`    | Text on `acc-fill`                                           |
| `acc-600`  | `#1d48ad` | `#4a68d0` | Pressed primary                                              |
| `acc-500`  | `#5b7be5` | `#7b95ec` | Light accent: progress, secondary marks                      |
| `acc-100`  | `#dfe7fb` | 24% tint  | Selected borders, the soft ring (`shadow-ring`)              |
| `acc-50`   | `#eef2fd` | 14% tint  | Selected row and card background, current nav row            |

The accent means "you can act here" or "this is selected". It is not a decoration colour.

### Signals

| Token                                | Use                                                      |
| ------------------------------------ | -------------------------------------------------------- |
| `red`, `red-tx`, `red-50`            | Errors, destructive actions, the Urgent priority mark    |
| `amber`, `amber-tx`, `amber-50`      | Warnings: WIP reached, sprint ends today, refused drop   |
| `green`, `green-tx`, `green-50`      | Success confirmations, healthy states                    |
| `on-solid`                           | White text or marks on any solid fill (type tiles, avatars) |

Solid (`red`) for marks and fills, `-tx` for text (passes 4.5:1), `-50` for the background
behind `-tx` text. Never put `red` text on `red-50`; use `red-tx`.

### Status categories

| Token  | Classic   | Dark      | Category                         |
| ------ | --------- | --------- | -------------------------------- |
| `todo` | `#888f9c` | `#6f7786` | To do (and backlog, won't do)    |
| `prog` | `#2356c9` | `#6f8ff0` | In progress, review, QA          |
| `done` | `#1f9d55` | `#3fb67a` | Done                             |

A status is coloured by its category only, whatever its name, so custom workflows read right.
Draw it with `StatusGlyph`, never a coloured pill.

### Type colours (fixed across themes)

`type-epic` `#6e56cf`, `type-story` `#1f9d55`, `type-task` `#2356c9`, `type-bug` `#e5484d`,
`type-subtask` `#0e9bb0`, `type-incident` `#d46a2e`. Dark mode lifts `type-task` to `#5b7be5`
(`brand-2`) and `type-epic` to `#7d68d8` so both hold 3:1 on dark cards (`MODE_TYPE_COLORS`).
Only `TypeGlyph` uses them. Custom types
pick from `TYPE_COLOR_CHOICES`.

### Epic palette (fixed)

`epic-1` `#2356c9`, `epic-2` `#6e56cf`, `epic-3` `#0e9bb0`, `epic-4` `#d46a2e`, `epic-5`
`#2f9e6e`, `epic-6` `#c2536a`, `epic-7` `#b7791f`, `epic-8` `#9b4f96`. The colour is stored on
the epic and is the same on every screen; read it with `epicColor()` from `@bemmoly/ui`. No
danger red, so an epic never reads as an error. The same eight hues serve `EntityTile`, space
tones and page icon tints.

### Avatar hues (fixed)

`avatar-green`, `avatar-orange`, `avatar-violet`, `avatar-pink`, `avatar-amber`, `avatar-sky`:
solid fills with white initials at 4.5:1 (`tokens.test.ts` checks each; amber was darkened to
meet it in ADR 0034). The signed-in person wears the accent; everyone else's hue comes from
their id (`avatarHue`). Only `Avatar` uses them.

### Brand and AI

`brand-1/2/3` are the logo's colours ([brand.md](brand.md#logo-colours-are-the-system)).
`ai` (fill, mark), `ai-600` (AI text), `ai-100` (AI borders), `ai-50` (AI backgrounds) are
lilac and reserved for AI output ([ai.md](ai.md)).

### Not for new code

The pastel pairs `green-bg/-fg`, `orange-bg/-fg`, `violet-bg/-fg`, `pink-bg/-fg`,
`amber-bg/-fg`, `sky-bg/-fg` (`HUE_TOKENS`) remain for the screens that still use them. New UI
uses the avatar, epic or signal families instead.

## Type

| Class     | Size | Use                                                          |
| --------- | ---- | ------------------------------------------------------------ |
| `text-11` | 11px | Meta: keys in chips, counts, sidebar section headings        |
| `text-12` | 12px | Secondary: hints, captions, tooltips, badges                 |
| `text-13` | 13px | UI default: rows, buttons, inputs, menus (`text-base` = 13px) |
| `text-14` | 14px | Reading: descriptions, comments, card titles in dialogs      |
| `text-16` | 16px | Section titles                                               |
| `text-20` | 20px | Page titles, dialog titles                                   |
| `text-24` | 24px | The greeting on Home; the largest product size               |

- One recorded exception: the Docs page title is 36px (with #77), drawn only by Docs'
  page title (`page/body/page-title.tsx`) and its skeleton. It stays until an ADR either adds a display step or brings it to
  24px; nothing else may use it. Docs' 12.5px property text is debt, not an exception.
- Weights: 400 body, 500 labels and nav, 600 titles and emphasis. No 700 in product UI.
- Line heights: `leading-display` 1.15, `leading-title` 1.3, `leading-card` 1.4,
  `leading-body` 1.5, `leading-desc` 1.6, `leading-doc` 1.65, `leading-prose` 1.7 (long reading).
- Tracking: `tracking-display` and `tracking-title` tighten large titles; `tracking-brand` the
  wordmark line. `tracking-caps` and `tracking-label` serve old capitalised marks only: new UI
  has no capitalised labels ([content.md](content.md)).
- Faces: `font-sans` is the preset's face (IBM Plex Sans in Classic and Dark; `FONTS` lists the
  four); `font-mono` is IBM Plex Mono for keys, code and tabular ids. Self-hosted via
  `@bemmoly/ui/fonts.css`; never load a font from a CDN.

## Radius

| Class            | Size  | Use                                                       |
| ---------------- | ----- | --------------------------------------------------------- |
| `rounded-tick`   | 2px   | Marks under 12px: epic swatches, progress bars            |
| `rounded-chip`   | 4px   | Chips, badges, labels' inner parts, crumbs, small buttons |
| `rounded-control`| 6px   | Buttons, inputs, selects, nav rows (`h-control` is 32px)  |
| `rounded-card`   | 8px   | Cards, menus, popovers, toasts                            |
| `rounded-dialog` | 12px  | Dialogs and sheets                                        |
| `rounded-full`   | full  | Avatars, pills, status glyphs, label dots                 |

## Elevation

| Class       | Use                                                                |
| ----------- | ------------------------------------------------------------------ |
| `shadow-e1` | Resting cards and the selected segment: a hairline ring and a breath of shadow |
| `shadow-e1h`| A card under the pointer or lifted for drag                        |
| `shadow-e2` | Menus, popovers, tooltips, the unfolded sidebar over the page      |
| `shadow-e3` | Dialogs, the palette, sheets                                       |

Dark mode elevations are white rings plus deeper shadows, so they read on dark surfaces. Rings
that are not elevation: `shadow-ring` (soft accent), `shadow-ring-ac` (solid accent),
`shadow-ring-node` (selected workflow node), `shadow-tab` (active tab underline),
`shadow-radio`, `shadow-halo` (overlapping avatars).

## Motion

| Token (`--duration-*`, `MOTION_MS`) | ms  | Use                                              |
| ----------------------------------- | --- | ------------------------------------------------ |
| `instant`                           | 90  | Press feedback, colour flips                     |
| `fast`                              | 120 | Hover, focus, the switch knob (default transition) |
| `base`                              | 160 | Menus, popovers, tooltips, rows arriving         |
| `slow`                              | 180 | Dialogs, the slide-over, toasts, a dropped card  |
| `exit`                              | 100 | Anything leaving                                 |

Easings: `ease-standard` (moving within the page), `ease-out` (arriving), `ease-in` (leaving),
`ease-settle` (a dropped card). Animations: `animate-fade-in/out`, `pop-in`, `dialog-in/out`,
`slide-in/out`, `toast-in/out`, `rise`, `settle`, and `drift` (the sign-in panel's ambient float,
about 13s, set per card with `--drift-x`, `--drift-y` and `--drift-period`; never on anything a
person reads or uses, ADR 0022); for overlays use `DIALOG_MOTION` and
`SHEET_MOTION` from `@bemmoly/ui`. Every animation sits behind `motion-safe:`; under reduced
motion every duration is zero ([accessibility.md](accessibility.md#motion)).

## Focus and timing

- `focus-ring`: 2px `acc` outline, 2px offset, on `:focus-visible` only (`FOCUS`). Inside clipped
  lists use `focus-ring-inset`; on a field wrapper `focus-ring-within`. From TS: `focusRing`,
  `focusRingInset`.
- `TIMING.tooltipDelayMs` 400, `TIMING.tooltipSkipMs` 300, `TIMING.toastMs` 6000.

## Print

Paper is read at arm's length, so a printed page (a PDF export, or the browser's print view)
has its own scale in points: `PRINT_TYPE`, `PRINT_LEADING`, `PRINT_SPACE`, `PRINT_MARGINS` and
`PRINT_PAPERS` from `@bemmoly/ui/tokens` (ADR 0035). Colours on paper are always the Classic
light theme's; no preset or dark mode follows a page out of the app.

| Token              | Value        | Use                                               |
| ------------------ | ------------ | ------------------------------------------------- |
| `PRINT_TYPE.meta`  | 8pt          | The running title and page numbers                |
| `PRINT_TYPE.small` | 9pt          | Code, tables, captions, issue chips               |
| `PRINT_TYPE.body`  | 10.5pt / 1.55 | Body text                                        |
| `PRINT_TYPE.h3`    | 12pt         | Third-level headings                              |
| `PRINT_TYPE.h2`    | 14pt         | Section headings                                  |
| `PRINT_TYPE.h1`    | 22pt         | The page title                                    |
| `PRINT_MARGINS`    | 18mm × 16mm  | Top and bottom hold the header and footer         |
| `PRINT_PAPERS`     | A4, Letter   | The two papers a PDF prints on                    |

Story: Design system/Print.

## Themes and modes

ADR 0021. A **theme** is a pair: a designed light and dark set of fifteen tokens (`canvas`,
`side`, `sunken`, `card`, `line`, `line-2`, `tx`, `tx-2`, `tx-3`, `acc`, `acc-500`, `acc-50`,
`acc-100`, `acc-fill`, `on-acc`), in `src/tokens/themes.ts`. **Mode** (`light`, `dark`, `system`)
and the **typeface** are separate choices. The theme and typeface are the workspace's, set only by
a workspace admin; the mode is the person's own (ADR 0021, amended). Nothing a theme does reaches the brand, AI, status,
signal, type, epic or avatar colours, the type scale, radius or spacing.

| Theme         | Tag        | Light accent / fill   | Dark accent / fill    |
| ------------- | ---------- | --------------------- | --------------------- |
| Bemmoly       | Default    | `#2356c9` / `#2356c9` | `#7b95ec` / `#4a68d0` |
| Graphite      | Neutral    | `#2356c9` / `#27272a` | `#8fa6f2` / `#e4e4e7` |
| Sand          | Warm       | `#2356c9` / `#2356c9` | `#7b95ec` / `#4a68d0` |
| Pine          | Green      | `#17675a` / `#17675a` | `#5fc0a8` / `#1d7a69` |
| High contrast | Accessible | `#1a44a6` / `#1a44a6` | `#a3b6f6` / `#a3b6f6` |

- `theme.css` keys each theme by `data-theme` and `data-mode` on any element; `data-mode='system'`
  follows `prefers-color-scheme`. `data-font` picks the typeface. Bemmoly light owns `:root`.
- Every set passes the fourteen checks of `themeChecks` (`@bemmoly/ui/theme`); High contrast is
  held to 7:1 text and 3:1 control borders. `tokens.test.ts` runs them on every theme and mode.
- **Reserved hues**: no accent may sit in these bands, because they already mean something.

| Hue band  | Means                     |
| --------- | ------------------------- |
| 340°–12°  | Errors, Bug, Blocked      |
| 18°–50°   | Warnings, Incident        |
| 120°–155° | Done, Story, success      |
| 255°–290° | AI (lilac), Epic (violet) |

- **Custom themes**: `buildCustomTheme({ brand, surface })` keeps the surfaces of `neutral`
  (Bemmoly) or `warm` (Sand) and moves only the accent tokens, the least that passes all fourteen
  checks, in both modes. A brand in a reserved band gets a warning, never a block. A saved custom
  theme becomes a theme source with `customThemeSource` and is applied as inline tokens.
- Screens never set theme colours themselves. Previews paint an element with `themeScope` (web)
  or `data-theme` and `data-mode`.
