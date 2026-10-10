# Premium design review

The design review that compares every screen as it is with the proposed redesign. Where it covers
a screen, a component or a part of the visual language, it is the source of truth; see
`docs/adr/0015-premium-visual-system.md`. The mocks in `../mocks` still hold for anything the
review does not draw (the content of most settings pages, the setup wizard's steps, the docs
editor's internals).

## Build it

The review is one self-contained HTML page built from these files. Nothing to install:

```sh
python3 docs/design/premium/build.py docs/design/premium docs/design/premium/dist/bemmoly-design-review.html
```

Open the result in a browser and toggle Current, Proposed or Side by side per tab. The built page
inlines every screenshot, so it is git-ignored; build it again after changing a source file.

## What is where

- `kit.css`: every proposed token and component style, scoped under `.px`. Read values here.
- `kit.js`: icon paths, the type, priority and status glyph drawings, avatars, tiles, the brand
  block and the one app frame (sidebar, settings sidebar, collapsed rail, header).
- `screens.js`, `brand.js`, `foundations.js`: each proposed screen, logo placement and the
  foundations sheet.
- `content.js`: every finding and every proposed change, per screen, in words.
- `screens/`: screenshots of the product before the redesign (1440px wide; the phone shots are
  390px at 2x), with the findings pinned on them.
- `template.html`, `app.js`, `build.py`: the review page itself.
