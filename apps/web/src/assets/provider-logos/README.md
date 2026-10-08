# Provider logos

One monochrome SVG per provider in the bundled AI catalog (`src/fixtures/ai-catalog.json`),
named by catalog id. `ProviderLogo` (`src/components/ai/provider-logo.tsx`) shows the file
as a mask filled with the primary text colour (`tx`) on the tile's chip, so every logo follows
the theme at full strength. models.dev publishes no brand colours, so none is applied. A provider
without a file here, such as one that only appears in a later live catalog, shows its
initials instead.

## Source

- Downloaded from models.dev: `https://models.dev/logos/<provider-id>.svg`
- Fetched on 2026-10-08, unchanged.
- `github-models`, `requesty` and `upstage` are deliberately absent: models.dev answers
  for them with its generic placeholder glyph, not a logo, so they fall back to initials.

To refresh, download the same URL for each id in the catalog, drop any file that matches the
placeholder, and update the date above.

## Trademarks

Each logo is a trademark of its owner. It is used only to identify that provider in the
provider picker, and does not imply endorsement of, or affiliation with, Bemmoly. These files
are not covered by the repository's MIT licence.
