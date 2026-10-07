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

## Banners

Profile banners, the README hero and the repository social preview, composed by
`scripts/brand-banners.ts` from the same parts as the social preview: the tagline, the line
about the product, the install command in a pill, the Board shot in a card frame bleeding off
the right edge and the accent glow, with every colour from the tokens and the text outlined
from the self-hosted IBM Plex. Each is rendered in the Classic light preset (the approved
look) and in Ocean with the Ocean Board capture (`-ocean`, for comparison).

The banners carry **no mark and no wordmark**: each platform shows the mark as the profile
picture beside the banner, so the only name on them is "bemmoly.com", small, in a corner. The
README hero and the repository social preview are shown with no avatar beside them, so those
two keep the lockup.

Regenerate after changing the copy, a capture or a token:

```sh
pnpm --filter @bemmoly/ui brand:banners      # banners only
pnpm --filter @bemmoly/ui brand:icons        # icons, social preview and banners
pnpm --filter @bemmoly/ui brand:banners --debug /tmp/banners   # also writes review copies
```

`--debug` writes copies with the safe zone dashed, the covered areas shaded and each text box
traced. They are for review only; do not commit them. The script refuses to render a banner
whose text leaves its safe zone, sits under a covered area or runs into the Board frame, so a
copy or size change that breaks a rule fails the build instead of shipping.

| File                                           | Size                    | Where it goes                                                     |
| ---------------------------------------------- | ----------------------- | ----------------------------------------------------------------- |
| `banner-x-1500x500.png`, `@2x`                 | 1500 x 500, 3000 x 1000 | X profile header                                                  |
| `banner-linkedin-company-1128x191.png`         | 1128 x 191              | LinkedIn company page cover                                       |
| `banner-linkedin-personal-1584x396.png`, `@2x` | 1584 x 396, 3168 x 792  | LinkedIn personal profile background                              |
| `banner-buymeacoffee-1600x400.png`             | 1600 x 400              | Buy Me a Coffee page cover                                        |
| `readme-hero.png`                              | 1280 x 400              | Top of the repository README (light; `-ocean` under dark mode)    |
| `github-social-preview-1280x640.png`           | 1280 x 640              | Repository Settings › General › Social preview (uploaded by hand) |

Each has a `-ocean` twin (`banner-x-1500x500-ocean.png`, `banner-x-1500x500-ocean@2x.png`, and
so on). The 2x files are for X and LinkedIn personal, which downscale a larger upload.

### Safe zones

All text sits inside the safe zone; only the glow and the Board frame reach the edges.

- **X header (1500 x 500).** Phones crop the top and bottom, so text stays in the central
  1500 x 360 band (y 70 to 430). On desktop the avatar overlaps the bottom-left 420 x 420, so
  the copy starts at x 480. "bemmoly.com" is top-right, above the frame.
- **LinkedIn company cover (1128 x 191).** The page logo overlaps about 270 x 140 at the
  bottom-left and phones show only the middle, so text stays in the right two-thirds (from x
  376), vertically centred: the tagline at 48px on one line and the line at 18px on two. The
  **install pill is dropped**: under the tagline and the line it would push the block past the
  191px height, and putting the line on one row to make room would squeeze the Board to a
  sliver. The Board is cropped to its top bar and the first column, starting at the Projects tab.
- **LinkedIn personal banner (1584 x 396).** The profile photo overlaps about 400 x 300 at
  the bottom-left, so text stays right of x 480.
- **Buy Me a Coffee cover (1600 x 400).** Size from Buy Me a Coffee's help page,
  [How to set up your Buy Me a Coffee page](https://help.buymeacoffee.com/en/articles/10184401-how-to-set-up-your-buy-me-a-coffee-page)
  ("1600px wide by 400px tall"). The page does not document overlaps, so they were measured on
  a live creator page: on phones (up to about 960px wide) the whole cover is shown with the
  round avatar centred over its bottom, covering x 587 to 1014 from y 157; on desktop there is
  no avatar on the cover, but the page's cards cover it from about y 270 at the narrowest
  desktop width. So text stays above y 260, and left of the avatar column below y 150: the
  tagline runs on one line across the top and the line and the pill sit at the left.
- **README hero (1280 x 400).** GitHub shows it about 900px wide, so the type is sized for
  0.7x: the 60px tagline, 24px line and 20px command read as about 42, 17 and 14px.
- **Repository social preview (1280 x 640).** The 1200 x 630 social preview's composition at
  GitHub's 2:1 size; the frame keeps its width and the copy column takes the extra.
