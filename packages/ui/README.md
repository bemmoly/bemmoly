# @bemmoly/ui

The Bemmoly design system: tokens, the theme builder, the icon set, the logo and the components
every screen is built from. Everything here is ported from the mocks in `docs/design/mocks`,
which are the pixel source of truth.

## Entry points

| Import                     | What it gives you                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `@bemmoly/ui`              | Components (and, for compatibility, the tokens).                                             |
| `@bemmoly/ui/tokens`       | Token names, presets, `THEMES`, `themeById`, scales.                                         |
| `@bemmoly/ui/theme`        | `buildTheme`, `contrastCheck`, `applyTheme`, `clearTheme`, `themeStyle`, `toHexColors`.      |
| `@bemmoly/ui/icons`        | `Icon` and the typed `IconName` set.                                                         |
| `@bemmoly/ui/tailwind.css` | The Tailwind 4 theme. Import after `tailwindcss`; it removes the default palette and scales. |
| `@bemmoly/ui/theme.css`    | Every preset as CSS variables, keyed by `data-theme` on any element (Classic on `:root`).    |
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

## Theme builder

```ts
import { applyTheme, buildTheme } from '@bemmoly/ui/theme';

const theme = buildTheme({ brand: '#f97316', mode: 'light', surfaces: 'tinted', font: 'inter' });
theme.contrast; // { ratio: '2.8', level: 'dark-text', message: '#f97316 is too light for white text …' }
applyTheme(document.documentElement, theme);
```

- `buildTheme({ brand, mode: 'light' | 'dark', surfaces: 'neutral' | 'tinted', font })` returns the
  full token set with the custom branch of the Board mock's theme table: accent tints by its
  `color-mix` formula, Classic or Dark neutrals, brand-tinted surfaces, darker and lighter accents.
- `contrastCheck(brand)` is the Appearance mock's `lum` and `ratio`, ported exactly, with its three
  messages. The builder keeps each message's promise: a mid-contrast brand (3 to 4.5:1) gets a darker
  button fill (`ac-fill`); a light brand gets dark button text (`on-ac`) and, in light mode, a darker
  link shade (`ac`).
- `applyTheme(el, theme)` writes the tokens as inline custom properties; `clearTheme(el, presetId)`
  returns to a preset; `themeStyle(theme)` gives the same as a style object; `toHexColors` resolves
  `color-mix()` values to hex for email.

Classic stays as exact hex. Its accent tints are hand-picked in the Board mock's `:root` block and
sit 3 to 17 steps per channel from the formula; the test records this. The other presets carry
hand-tuned neutral scales; the builder reproduces their accent tints (tested), not their neutrals.

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
