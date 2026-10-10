# Marketing site

bemmoly.com (`apps/site`, Astro) is the product's first screen. It uses the same system, so it can
never drift from what a visitor installs.

## Same tokens, same lockup

- **Tokens from `@bemmoly/ui`.** `apps/site/src/styles/site.css` imports
  `@bemmoly/ui/tailwind.css` and `@bemmoly/ui/fonts.css`, and the theme variables are inlined from
  the tokens (`src/lib/theme.ts`). Colours, radii, elevations and motion are the product's.
- **Display sizes live in one place.** The landing page's larger steps (hero, section titles,
  lede) are declared once in the `@theme` block of `site.css`. They are for `apps/site` only; the
  product never uses them, and no literal colour lives there.
- **The dark version is the product's Dark**: `#111418` surfaces with `#5B7BE5` as the accent,
  the same as the app's dark mode. No other preset's colours on the site.
- **The lockup and mark are the brand files** (`@bemmoly/ui/brand/*`), with the same rules as in
  [brand.md](brand.md): no recolouring, no rebuilt lockup, module tiles in the logo's colours at
  its corner ratio.
- **Icons are drawn.** The same Lucide set and the same ban on typed glyphs (`→ ✓ · ↗` as
  icons); no two-letter initials standing in for icons.
- **Pictures are the real product**: posters captured from the current demo build, light and
  dark, in the one frame. Never a mock of something that has not shipped.

## The three promises are the spine

Every page is built around three promises, word for word:

1. **100% open source.** MIT, every feature, no open-core edition.
2. **No pricing.** No plans, tiers, seat limits or trial. The only cost is the server you run.
3. **No in-app purchases.** No paywalls, upsells, add-ons or sales calls, now or later.

Where they appear: the hero's ticks, a section of their own with proof under each, the FAQ, the
final call, the self-hosting guide's header and the footer line ("MIT licensed · free forever ·
no in-app purchases"). The product must keep them true: anything in the app that suggests
billing, licences to buy or an upgrade breaks a promise and fails review.

## Honest claims only, proven by code

- **Every claim links to the file that proves it.** A "How we know" page cites the code. When
  the site adds that page, a test in `apps/site/tests` checks each cited file still holds the
  line it quotes, so a claim cannot outlive its proof.
- **No future versions as promises.** Unbuilt work is "planned" in the neutral badge, never "in
  0.5". A version number on unbuilt work becomes false the day plans move.
- **Status badges are honest**: Available, New, Untested, Planned. AI is one lilac "coming,
  optional" band, with no picture until a real screen exists.
- **Estimates are labelled as estimates** ("about five minutes") until measured, then the
  measured figure replaces them at build time.
- **No absolutes the code cannot back.** Not "your data never leaves your hardware" when the
  admin configures mail, backups and certificates elsewhere; say what stays and what you choose
  to send.
- **Competitors appear only as import sources** ("Import from Confluence"), per
  [content.md](content.md#other-products-names).
- **No third-party scripts, no analytics, a strict CSP**, and the performance budget holds.

## Voice

- The brand line is "Your work. Your platform." Lead with what it is (issues, boards and docs),
  for whom (your whole company) and the deal (your server, one command, forever).
- Same content rules as the product: sentence case, verbs on buttons ("Install", "Open the
  demo"), no exclamation marks, no superlatives without proof.
- Copy buttons confirm with an icon and an announcement, and fall back when the clipboard is
  refused.

## Checks

- `pnpm --filter @bemmoly/site build` and its tests pass.
- No colour, size or font is defined in `apps/site` outside `site.css`'s `@theme` block.
- Every number and claim on a changed page has a source link or is labelled as an estimate.
