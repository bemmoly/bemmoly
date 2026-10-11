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

| File             | What it is                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `mark-*.svg`     | The four-tile mark (top bar, favicon, app icons).                                                                     |
| `wordmark-*.svg` | The "Bemmoly" lettering alone.                                                                                        |
| `lockup-*.svg`   | Mark and wordmark side by side, 10 units apart, the lettering at 115% so the word carries beside the mark (ADR 0015). |

Each comes in four tones:

| Suffix   | Use                                                         | Colours                                                                                                                                                                                                                                                                                                                   |
| -------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-color` | Default in the app (`tone="auto"`).                         | Blue tiles `var(--brand-mark-bg, #2356C9)`, mid tile `var(--brand-mark-mid, #5B7BE5)`, lilac tile `var(--brand-mark-fg, #9A85EA)`, lettering `currentColor` (`Logo` sets it to `--tx`). `Logo` draws every tile in its designed colour on every preset and every custom theme: themes never recolour the mark (ADR 0015). |
| `-dark`  | On light backgrounds where CSS variables are not available. | Tiles `#1b2430`, `#4b5565` (mid), `#8690a0` (lilac); lettering `#1b2430`.                                                                                                                                                                                                                                                 |
| `-light` | On dark backgrounds.                                        | Tiles white at 100%, 80% (mid) and 60% (lilac); white lettering.                                                                                                                                                                                                                                                          |
| `-mono`  | One colour (print, embossing, single-colour UI).            | Everything `currentColor`; tiles at 100%, 75% (mid) and 55% (lilac) opacity so the groups still read.                                                                                                                                                                                                                     |

The app's CSP refuses inline style attributes, so `Logo` rewrites each `style="fill: var(--x, #hex)"`
into `fill="#hex"` before inlining a file.

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

- The logo's colours are the product's colour system (ADR 0015): `#2356C9` is the accent and Work, `#5B7BE5` Docs and the dark accent, `#9A85EA` AI only (the `--brand-1/2/3` and `--ai` tokens).

## Generated files (`generated/`, committed)

Built from `mark-color.svg` (its designed colours) and `lockup-color.svg`; the plates use the Classic
preset surface and the designed blue:

| File                                             | Size     | Use                                                                                                                                                           |
| ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `favicon.svg`                                    | vector   | `<link rel="icon" type="image/svg+xml">`; the mark on transparent                                                                                             |
| `favicon-32.png`                                 | 32       | `<link rel="icon" sizes="32x32">`; mark at 72% on a white rounded square                                                                                      |
| `apple-touch-icon.png`                           | 180      | `<link rel="apple-touch-icon">`; mark at 72% on a full-bleed white square (iOS rounds it and would paint transparent corners black)                           |
| `icon-192.png`, `icon-512.png`                   | 192, 512 | PWA manifest, `"purpose": "any"`; mark at 72% on a white rounded square                                                                                       |
| `icon-maskable-192.png`, `icon-maskable-512.png` | 192, 512 | PWA manifest, `"purpose": "maskable"`; solid `#2356C9`, mark at 64% inside the safe zone with the blue tiles white, the mid tile 80% white and the lilac kept |

The app imports them through the package export `@bemmoly/ui/brand/generated/<file>`.

## Social previews and banners

The social previews, profile banners, README hero and repository social preview are rendered
by the same generator as the launch kit, `docs/launch-kit/src/render.ts`: HTML and CSS
templates (`docs/launch-kit/src/templates.ts`, the `BRAND` list) rendered to PNG with
Playwright at each platform's exact size. Every one is light, uses the logo's colours only,
and carries the three promises as drawn check marks: 100% open source, No subscription, No in-app
purchases. The product in them is a real capture of the demo (`docs/launch-kit/src/shots`),
never a mock; on the banners it is a tilted glimpse of the board rather than a full frame.

Profile banners carry **no mark and no wordmark**: each platform shows the mark as the avatar
beside them, so "bemmoly.com" sits above the tagline instead. The README hero and the social
previews are shown with no avatar beside them, so they keep the lockup. The copy is "Your work.
Your platform." over "Self-hosted issues and docs." with no version number.

Sharpness: the demo is captured at 3x and the upload files are rendered at 2x to 3.7x from the
same templates, so the product is always downscaled, never enlarged. Tilts are 3 degrees and no
filter touches a screenshot.

Regenerate after a UI, copy or token change:

```sh
pnpm --filter @bemmoly/web exec vite --mode demo --port 5500   # in another terminal
pnpm --filter @bemmoly/ui brand:captures   # real screenshots of the demo
pnpm --filter @bemmoly/ui brand:banners    # these files only
node docs/launch-kit/src/render.ts         # captures, these files and the launch kit
```

`docs/launch-kit/index.html` shows every file at real size with a "Show safe areas" toggle:
green is where text must stay, red is what the platform covers, and the white shape is the
avatar or page logo itself.

| File                                           | Size                   | Where it goes                                                                                   |
| ---------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| `social-preview.png`                           | 1200 x 630             | `og:image` and `twitter:image` for bemmoly.com                                                  |
| `social-preview-square.png`                    | 1080 x 1080            | Platforms that crop square                                                                      |
| `github-social-preview-UPLOAD-2560x1280.png`   | 2560 x 1280            | Repository Settings › General › Social preview: the file to upload (`-1280x640` is the preview) |
| `readme-hero.png`, `readme-hero-dark.png`      | 1280 x 400             | Top of the repository README, light and under dark mode                                         |
| `x-header-UPLOAD-3000x1000.png`                | 3000 x 1000            | X profile header: the file to upload (`banner-x-1500x500.png` is the preview)                   |
| `linkedin-cover-UPLOAD-4200x700.png`           | 4200 x 700             | LinkedIn company page cover: the file to upload                                                 |
| `linkedin-cover-UPLOAD-3384x573.png`           | 3384 x 573             | The same cover at 3x of 1128 x 191, if LinkedIn asks for that ratio                             |
| `banner-linkedin-company-1128x191.png`         | 1128 x 191             | Preview of the LinkedIn cover at its display size; do not upload                                |
| `banner-linkedin-personal-1584x396.png`, `@2x` | 1584 x 396, 3168 x 792 | LinkedIn personal profile background                                                            |
| `banner-buymeacoffee-1600x400.png`             | 1600 x 400             | Buy Me a Coffee page cover                                                                      |

### Safe zones

All text sits inside the safe zone; only the background and the product glimpse reach the edges.

- **X header (1500 x 500).** The avatar covers the bottom-left (treated as the left 32% by the
  bottom 45%; on desktop a 134px circle from x 15 overlapping the bottom 70px) and phones crop
  about 60px off the top and bottom. So the words, all three promises and the install command
  (`INSTALL_COMMAND` from `apps/site/src/lib/links.ts`) sit top-right, from x 590 and between
  y 70 and 330, and the product glimpse takes the left, where the avatar may
  cover it.
- **LinkedIn company cover (1128 x 191, and 4200 x 700).** The page logo overlaps about
  270 x 140 at the bottom-left on desktop and phones crop the sides, so the copy runs from x 300
  to about x 750, from the top: bemmoly.com, the tagline on one line, the promises on one row
  and the install command in a terminal chip. The board glimpse sits at the right edge, where a phone's crop only trims it.
- **LinkedIn personal banner (1584 x 396).** The profile photo overlaps about 400 x 300 at the
  bottom-left, so text stays right of x 470.
- **Buy Me a Coffee cover (1600 x 400).** Size from Buy Me a Coffee's help page,
  [How to set up your Buy Me a Coffee page](https://help.buymeacoffee.com/en/articles/10184401-how-to-set-up-your-buy-me-a-coffee-page).
  Measured on a live page: on phones the avatar is centred over x 587 to 1014 from y 157, and
  on desktop the page's cards cover it from about y 270. So all text stays above y 150.
- **README hero (1280 x 400).** GitHub shows it about 900px wide, so the type is sized to read
  at 0.7x.
