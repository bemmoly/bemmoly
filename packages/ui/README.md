# @bemmoly/ui

The Bemmoly design system: tokens, the five themes and the custom theme generator, the icon set, the logo and the components
every screen is built from. Everything here is ported from the mocks in `docs/design/mocks`,
which are the pixel source of truth.

## Entry points

| Import                     | What it gives you                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `@bemmoly/ui`              | Components (and, for compatibility, the tokens).                                             |
| `@bemmoly/ui/tokens`       | Token names, `THEME_SOURCES`, `resolveTheme`, `RETIRED_PRESETS`, scales.                     |
| `@bemmoly/ui/theme`        | `buildCustomTheme`, `themeChecks`, `reservedHue`, `applyTheme`, `themeStyle`, `toHexColors`. |
| `@bemmoly/ui/icons`        | `Icon` and the typed `IconName` set.                                                         |
| `@bemmoly/ui/tailwind.css` | The Tailwind 4 theme. Import after `tailwindcss`; it removes the default palette and scales. |
| `@bemmoly/ui/theme.css`    | Every theme × mode, keyed by `data-theme` and `data-mode`, plus `data-font` typefaces.       |
| `@bemmoly/ui/fonts.css`    | The self-hosted typefaces.                                                                   |
| `@bemmoly/ui/brand/*`      | Brand files and the generated favicons and app icons (see `assets/brand/README.md`).         |

## Rules

- Tokens are the only source of colour, type size, radius, leading, tracking and shadow. Use the
  Tailwind utilities they generate (`bg-sf`, `text-tx4`, `border-br3`, `text-12h`, `rounded-card`,
  `shadow-menu`). A test fails on any literal colour in a component.
- Animate only behind `motion-safe:`. The base CSS also stops all motion under
  `prefers-reduced-motion`.
- Every interactive component shows the keyboard focus ring from `lib/focus.ts`.
- The logo is drawn only by `<Logo>`, from the files in `assets/brand`.

## The AI accent

One accent is reserved for content the AI produced, and nothing else uses it:

| Token       | Classic   | Used for                                                      |
| ----------- | --------- | ------------------------------------------------------------- |
| `--ai`      | `#2456c9` | The AI dot, AI titles, AI action text.                        |
| `--ai-mute` | `#7a93d9` | Provenance ("from 14 comments, 2 PRs"), the ⌘K hint.          |
| `--ai-bg`   | `#f6f8fe` | AI card and suggestion backgrounds.                           |
| `--ai-tint` | `#eef3fe` | The "Ask Bemmoly" pill.                                       |
| `--ai-br`   | `#cdd8f3` | AI card border, AI action borders, the risk bar.              |
| `--ai-br2`  | `#d9e1f5` | The lighter border of page-level AI cards and the plan table. |
| `--ai-tx`   | `#2c3545` | Body copy inside AI briefs and suggestions.                   |

Every mock draws AI content in the accent family, so these start equal to the accent tokens in
every preset and custom theme. Components refer only to the `ai-*` names, so a preset can move AI
to its own hue without code changes. Only `components/ai-surface`, the command palette and AI
toasts may use them; a test enforces it. Non-AI notes that look similar use the accent tokens
(`ac-bg2`, `ac-br2`).

### Writing AI copy

- First person, as the assistant: "I drafted a reply", "I couldn't reach the provider".
- State the consequence: what changed, or what did not happen.
- State the next action: what the person can do, or what happens next ("I'll retry in 30 seconds").
- Never "An error occurred", "Something went wrong" or a bare code. Name the cause in plain words.
- Say what the AI read ("from 14 comments, 2 PRs") and that nothing runs until a person confirms.
- Every AI answer offers "Not useful".

## Themes and the custom theme generator

ADR 0021. Five themes (Bemmoly, Graphite, Sand, Pine, High contrast), each a designed light and
dark set of fifteen tokens in `src/tokens/themes.ts`. Mode (`light`, `dark`, `system`) and the
typeface are separate choices: `data-mode` and `data-font` on the root.

```ts
import { buildCustomTheme, customThemeSource, applyTheme } from '@bemmoly/ui/theme';
import { resolveSource } from '@bemmoly/ui/tokens';

const built = buildCustomTheme({ brand: '#0f766e', surface: 'neutral' });
built.pass; // true: all fourteen checks pass in both modes, for any input
built.guard; // null, or the reserved hue band the brand sits in (a warning, never a block)
const source = customThemeSource(id, 'Acme', { brand: '#0f766e', surface: 'neutral' });
applyTheme(document.documentElement, resolveSource(source, 'dark'));
```

- `themeChecks(set, mode, highContrast)` runs the fourteen checks of the theme review; the token
  tests run them on every theme and mode, and the generator and the server run them on custom
  themes.
- The generator keeps the surfaces of the chosen style (`neutral` from Bemmoly, `warm` from
  Sand) and moves only the accent tokens, the least that passes. It never touches the logo.

## Storybook

```sh
pnpm --filter @bemmoly/ui storybook   # http://localhost:6006
pnpm --filter @bemmoly/ui build       # static build in storybook-static/
```

Each story shows a 1:1 crop of its mock beside it (toolbar "Mock" turns it off). The "Theme"
toolbar switches the eight presets and a custom orange theme; "Mode" rebuilds any preset in the
other mode with `buildTheme`. "Overview / All components" shows everything on one page.

## Other scripts

```sh
pnpm --filter @bemmoly/ui tokens:css   # regenerate theme.css, tailwind.css and styles/ from tokens
pnpm --filter @bemmoly/ui brand:icons  # regenerate favicons and app icons from assets/brand
```

## Departures from the mocks

- Secondary buttons use `tx2` text, as 25 of the 38 bordered buttons in the mocks do; the Board's
  header buttons inherit `tx`.
- "In progress" uses `ac-bg` and `ac` (Board mock) everywhere; Backlog, Home and Doc Editor write
  `#e8eefc`. "In review" is violet everywhere, although the Board's subtask list paints it accent.
- In dark themes, status, signal and avatar pairs are derived with the Board mock's people remap;
  the mocks leave them light.
- The logo mark is a "B" placeholder on the mock's tile, per the product owner, instead of the
  mocks' 2x2 grid; see `assets/brand/README.md`.
- The mocks show no focus states, hover states, modal, toast, tooltip, empty state or skeleton.
  These are built from mock parts and named as such in each component's comment.
- Board's runtime computes Classic's accent tints with `color-mix`; the tokens use the hex its
  `:root` block and every other mock state.
- Icons are Lucide icons under the design system's names instead of the mocks' CSS-drawn shapes
  and text glyphs (⌕ ▾ ✕ ···), at 16px in buttons, rows and carets, 18px in the top bar and 14px in
  small controls, with a 1.5px stroke like the mocks' borders (1.75px for chevrons). Dropdown
  carets are tx4 at rest and tx while open or focused, instead of the mocks' 10px ▾ in tx5.

## Third-party notices

- Icons: [Lucide](https://lucide.dev) (`lucide-react`), ISC License, Copyright (c) Lucide Icons
  and Contributors; the icons Lucide takes from Feather are MIT, Copyright (c) Cole Bemis. The
  full text ships with the package as `lucide-react/LICENSE`.
