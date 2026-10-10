# Docs design review

The review of the Docs module: every Docs screen as it is, beside the proposed redesign. It extends
the shell review one folder up (`../`) and, where it draws a Docs screen or component, it is the
source of truth for it (ADR 0015). The mocks in `../../mocks` still hold for what neither review
draws.

## Build it

One self-contained HTML page, built from these files. Nothing to install:

```sh
python3 docs/design/premium/docs/build.py docs/design/premium/docs docs/design/premium/docs/dist/bemmoly-docs-review.html
```

Open it in a browser and toggle Current, Proposed or Side by side per tab. The built page inlines
every screenshot, so it is git-ignored; build it again after changing a source file.

## What is where

- `docs-kit.css`, `docs-kit.js`: the Docs components (page tree rows, page header, cover, TL;DR
  card, comment rail, history), scoped under `.px`. Read values here.
- `docs-screens.js`, `docs-tree.js`: each proposed Docs screen, and the sidebar page tree.
- `docs-found.js`: the Docs foundations sheet.
- `content.js`: every finding, proposed change and interaction note, per screen, in words.
- `app.js`: the review page, including `planDoc()`, the phased build plan with file paths.
- `kit.css`, `kit.js`, `screens.js`, `brand.js`: copies of the shell review's kit that this page
  draws with; the originals one folder up win if they ever differ.
- `screens/`: screenshots of Docs before the redesign (1440px wide; the phone shot is 390px at
  2x).
- `template.html`, `build.py`: the page shell and its build.
