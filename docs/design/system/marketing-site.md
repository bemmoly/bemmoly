# Marketing site

bemmoly.com (`apps/site`, Astro) is the product's first screen. It uses the same system, so it can
never drift from what a visitor installs.

## Same tokens, same lockup

- **Tokens from `@bemmoly/ui`.** `apps/site/src/styles/site.css` imports
  `@bemmoly/ui/tailwind.css` and `@bemmoly/ui/fonts.css`; `src/lib/theme.ts` builds the theme
  variables from `@bemmoly/ui/tokens` at build time and inlines them in every page. Colours,
  radii, elevations, motion and focus are the product's.
- **Two themes, the product's own**: Classic light on `:root`, the product's Dark (`#111418`
  surfaces, the `#5B7BE5`-based accent) when the visitor's system asks for it or they choose it
  in the footer. `data-theme="dark"` on an element makes a dark island (the self-hosting band,
  terminal blocks). No other preset's colours on the site.
- **Display sizes live in one place.** The marketing-only steps (64 hero, 40 hero on a phone, 44
  section, 32 sub-section, 22 card title, and the text pages' older 14.5, 17 and 19) plus the
  `window`, `shot` and `band` radii are declared once in the `@theme` block of `site.css`. They
  are for `apps/site` only; the product never uses them, and no literal colour lives there.
- **The lockup and mark are the brand files**, inlined by `src/components/site/Logo.astro` from
  `@bemmoly/ui/brand/*`, with the rules in [brand.md](brand.md): no recolouring, no rebuilt
  lockup. Module tiles (`ModuleTile.astro`) are the module's logo colour at the logo's corner
  ratio, with AI in lilac and nothing else in lilac.
- **Icons are drawn.** `src/lib/icons.ts` is the site's set: the product's icons
  (`@bemmoly/ui/icons`) plus the few a marketing page needs, from the same Lucide release,
  rendered to SVG at build time by `Icon.astro`. It is the only site file that may import Lucide.
  The glyph-character ban covers `.astro` pages; no two-letter initials stand in for icons.
- **Pictures are the real product**: posters captured from the current demo build, light and
  dark, in the one frame. Never a mock of something that has not shipped.

## The three promises are the spine

Every page is built around three promises, word for word:

1. **100% open source.** MIT, every feature, no open-core edition.
2. **No pricing.** No plans, tiers, seat limits or trial. The only cost is the server you run.
3. **No in-app purchases.** No paywalls, upsells, add-ons or sales calls, now or later.

Where they appear: the hero's ticks, a section of their own with proof under each, the FAQ, the
final call, the self-hosting guide's header and the footer line. The product must keep them
true: anything in the app that suggests billing, licences to buy or an upgrade breaks a promise
and fails review.

## Honest claims only, proven by code

- **Every claim a sceptic would doubt links to the file that proves it**: `src/data/proofs.ts`
  names the file and quotes the line, and `tests/promises.test.ts` fails the build the day the
  file loses that line, so the site stops making the claim. A new claim adds its proof there.
- **No future versions as promises.** Unbuilt work is "planned" in the neutral badge, never "in
  0.5". A version number on unbuilt work becomes false the day plans move.
- **Status badges are honest**: available, new, untested, planned. AI is one lilac "coming,
  optional" band, with no picture until a real screen exists.
- **Estimates are labelled as estimates** until measured; then the measured figure replaces them
  at build time.
- **No absolutes the code cannot back.** Not "your data never leaves your hardware" when the
  admin configures mail, backups and certificates elsewhere; say what stays and what you choose
  to send.
- **Competitors appear only as import sources** ("Import from Confluence"), per
  [content.md](content.md#other-products-names).
- **No third-party scripts, no analytics, a strict CSP** (`tests/csp.test.ts`), and the
  performance budget holds.

## Voice

- The brand line is "Your work. Your platform." Lead with what it is (issues, boards and docs),
  for whom (your whole company) and the deal (your server, one command, forever).
- Same content rules as the product: sentence case, verbs on buttons ("Install", "Open the
  demo"), no exclamation marks, no superlatives without proof.
- Copy buttons confirm with an icon and an announcement, and fall back when the clipboard is
  refused.

## Checks

- `pnpm --filter @bemmoly/site build`, then its tests, pass (the promises test reads the built
  page).
- `pnpm lint` passes: `bemmoly/no-glyph-characters` and `bemmoly/no-literal-styles` cover
  `src/**/*.{astro,ts}`.
- No colour, size or font is defined in `apps/site` outside `site.css`'s `@theme` blocks.
- Every number and claim on a changed page has a proof or is labelled as an estimate.
