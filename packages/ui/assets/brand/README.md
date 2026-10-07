# Brand files

These SVG files are the only source of the Bemmoly logo. The `Logo` component in
`src/components/logo` inlines them, and `pnpm --filter @bemmoly/ui brand:icons` turns them into
favicons and app icons. No component draws the logo any other way.

The mark is the designed "tilted tiles" logo: four tiles in three colours, the two left tiles
in blue `#2356C9`, one right tile in mid blue `#5B7BE5` and the other in lilac `#9A85EA`, on a
transparent background. The designer's file is committed as `source/bemmoly-icon.svg`
(512 x 512); `pnpm --filter @bemmoly/ui brand:marks` builds the `mark-*` and `lockup-*` files
from it (the `wordmark-*` files, IBM Plex Sans SemiBold outlined to paths, are drawn by hand).
It replaces the placeholder "B" glyph on an accent tile.

## Variants

| File             | What it is                                                           |
| ---------------- | -------------------------------------------------------------------- |
| `mark-*.svg`     | The four-tile mark (top bar, favicon, app icons).                    |
| `wordmark-*.svg` | The "Bemmoly" lettering alone.                                       |
| `lockup-*.svg`   | Mark and wordmark side by side, 9px apart (the top bar brand block). |

Each comes in four tones:

| Suffix   | Use                                                         | Colours                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `-color` | Default in the app (`tone="auto"`).                         | Blue tiles `var(--brand-mark-bg, #2356C9)`, mid tile `var(--brand-mark-mid, #5B7BE5)`, lilac tile `var(--brand-mark-fg, #9A85EA)`, lettering `currentColor` (`Logo` sets it to `--tx`). The designed colours are the default on every preset. Only under a custom brand theme (`data-theme="custom"`) does `Logo` recolour the tiles: `--ac`, `--ac-l`, and the brand colour mixed 45% with `--sf` (lighter in light mode, toward the surface in dark mode). This replaces the placeholder's "accent tile and on-accent glyph" rule. |
| `-dark`  | On light backgrounds where CSS variables are not available. | Tiles `#1b2430`, `#4b5565` (mid), `#8690a0` (lilac); lettering `#1b2430`.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `-light` | On dark backgrounds.                                        | Tiles white at 100%, 80% (mid) and 60% (lilac); white lettering.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `-mono`  | One colour (print, embossing, single-colour UI).            | Everything `currentColor`; tiles at 100%, 75% (mid) and 55% (lilac) opacity so the groups still read.                                                                                                                                                                                                                                                                                                                                                                                                                                |

The app's CSP refuses inline style attributes, so `Logo` rewrites each `style="fill: var(--x, #hex)"`
into `class="x" fill="#hex"` before inlining a file; the class is what a custom theme recolours.

## Contract

Keep this stable so a replacement drops in without code changes:

- Every file's `viewBox` is 24 units tall and starts at `0 0`. The mark is `0 0 24 24`; the
  wordmark and lockup may be any width at that height (60.3 and 93.3 today).
- File names and the four tone suffixes stay exactly as above.
- No `id` attributes (several logos can be inline on one page), no `<title>` or `<desc>` (the
  component supplies the accessible name) and no `<text>` (outline lettering to paths).
- `-color` files use only `--brand-mark-bg`, `--brand-mark-mid`, `--brand-mark-fg` (each with its
  designed colour as the fallback) and `currentColor`, written as `style="fill: var(...)"`.

## Replacing the logo

1. Replace `source/bemmoly-icon.svg` and run `pnpm --filter @bemmoly/ui brand:marks` (or edit the
   twelve SVG files by hand, keeping the names and the contract above).
2. Run `pnpm --filter @bemmoly/ui brand:icons` to regenerate `generated/`.
3. Commit all three. The Logo story in Storybook shows every variant on every preset for review.

## Pending

- The lilac `#9A85EA` is reserved as the future AI accent; the `--ai` tokens will be revisited when the AI release is designed, and are not tied to the mark today.

## Generated files (`generated/`, committed)

Built from `mark-color.svg` (its designed colours) and `lockup-color.svg`; the plates use the Classic
preset surface and the designed blue:

| File                                             | Size        | Use                                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `favicon.svg`                                    | vector      | `<link rel="icon" type="image/svg+xml">`; the mark on transparent                                                                                                                                                                                                       |
| `favicon-32.png`                                 | 32          | `<link rel="icon" sizes="32x32">`; mark at 72% on a white rounded square                                                                                                                                                                                                |
| `apple-touch-icon.png`                           | 180         | `<link rel="apple-touch-icon">`; mark at 72% on a full-bleed white square (iOS rounds it and would paint transparent corners black)                                                                                                                                     |
| `icon-192.png`, `icon-512.png`                   | 192, 512    | PWA manifest, `"purpose": "any"`; mark at 72% on a white rounded square                                                                                                                                                                                                 |
| `icon-maskable-192.png`, `icon-maskable-512.png` | 192, 512    | PWA manifest, `"purpose": "maskable"`; solid `#2356C9`, mark at 64% inside the safe zone with the blue tiles white, the mid tile 80% white and the lilac kept                                                                                                           |
| `social-preview.png`                             | 1200 x 630  | `og:image` and `twitter:image`: lockup, tagline, one line about the product, the install command and a framed slice of the Board shot (`apps/site/src/assets/screens/board.png`) on the Classic background with an accent glow; composed by `scripts/social-preview.ts` |
| `social-preview-square.png`                      | 1080 x 1080 | The same elements stacked (lockup, copy, Board) for platforms that crop square                                                                                                                                                                                          |

The app imports them through the package export `@bemmoly/ui/brand/generated/<file>`.
