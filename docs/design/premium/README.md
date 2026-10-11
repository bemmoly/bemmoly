# Premium design review

> **History and evidence.** The rules now live in the design system,
> [`../system/`](../system/README.md) (ADR 0016). Read this review for why a rule exists; follow
> the system for what to build. New screens still add their interaction notes under
> `interaction/`.

The design review that compares every screen as it is with the proposed redesign (ADR 0015). The
mocks in `../mocks` are superseded wherever the review or the system covers a screen.

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
