# Brand files

These SVG files are the only source of the Bemmoly logo. The `Logo` component in
`src/components/logo` inlines them, and `pnpm --filter @bemmoly/ui brand:icons` turns them into
favicons and app icons. No component draws the logo any other way.

The current mark is a placeholder: a "B" (IBM Plex Sans SemiBold, outlined to paths) on the
accent tile at the size and radius of the mocks' top bar tile (24px, 6px radius). It will be
replaced by a designed logo by swapping these files.

## Variants

| File             | What it is                                                           |
| ---------------- | -------------------------------------------------------------------- |
| `mark-*.svg`     | The square tile mark (top bar, favicon, app icons).                  |
| `wordmark-*.svg` | The "Bemmoly" lettering alone.                                       |
| `lockup-*.svg`   | Mark and wordmark side by side, 9px apart (the top bar brand block). |

Each comes in four tones:

| Suffix   | Use                                                           | Colours                                                                                                                                                                                                     |
| -------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-color` | Default in the app (`tone="auto"`). Follows the active theme. | Tile `var(--brand-mark-bg, currentColor)`, glyph `var(--brand-mark-fg, #fff)`, lettering `currentColor`. `Logo` sets the variables to the theme's `--ac-fill` and `--on-ac`, and the text colour to `--tx`. |
| `-dark`  | On light backgrounds where CSS variables are not available.   | `#1b2430` tile and lettering, white glyph.                                                                                                                                                                  |
| `-light` | On dark backgrounds.                                          | White tile and lettering, `#0f1217` glyph.                                                                                                                                                                  |
| `-mono`  | One colour (print, embossing, single-colour UI).              | Everything `currentColor`; the glyph is knocked out of the tile (even-odd fill).                                                                                                                            |

## Contract

Keep this stable so a replacement drops in without code changes:

- Every file's `viewBox` is 24 units tall and starts at `0 0`. The mark is `0 0 24 24`; the
  wordmark and lockup may be any width at that height (the placeholder uses 61 and 94).
- File names and the four tone suffixes stay exactly as above.
- No `id` attributes (several logos can be inline on one page) and no `<text>` (outline the
  lettering to paths so it renders without the font).
- `-color` files use only `--brand-mark-bg`, `--brand-mark-fg` and `currentColor` for colour.

## Replacing the logo

1. Overwrite the twelve SVG files, keeping the names and the contract above.
2. Run `pnpm --filter @bemmoly/ui brand:icons` to regenerate `generated/`.
3. Commit both. The Logo story in Storybook shows every variant on every preset for review.

## Generated files (`generated/`, committed)

Built from `mark-color.svg` and `lockup-color.svg` with the Classic preset colours:

| File                                             | Size       | Use                                                                   |
| ------------------------------------------------ | ---------- | --------------------------------------------------------------------- |
| `favicon.svg`                                    | vector     | `<link rel="icon" type="image/svg+xml">`                              |
| `favicon-32.png`                                 | 32         | `<link rel="icon" sizes="32x32">`                                     |
| `apple-touch-icon.png`                           | 180        | `<link rel="apple-touch-icon">` (full bleed; iOS rounds it)           |
| `icon-192.png`, `icon-512.png`                   | 192, 512   | PWA manifest, `"purpose": "any"`                                      |
| `icon-maskable-192.png`, `icon-maskable-512.png` | 192, 512   | PWA manifest, `"purpose": "maskable"` (mark inside the 80% safe zone) |
| `social-preview.png`                             | 1200 x 630 | `og:image` placeholder                                                |

The app imports them through the package export `@bemmoly/ui/brand/generated/<file>`.
