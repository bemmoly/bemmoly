# Design mocks

`mocks/` holds the 14 product screens that are the pixel source of truth for Bemmoly.
Open `mocks/Bemmoly App.dc.html` in a browser; it links to every other screen.
Each file is self-contained HTML plus `support.js`; the data behind a screen lives in a
`class Component extends DCLogic` block near the end of the file.

`mocks-export.zip` is the original export. The extracted files are what the code is built from.

Changes the tech design has queued for the mocks (the design is otherwise followed exactly):

- Setup wizard, AI step: a "popular providers" row (names and logos from the models.dev catalog)
  with the full searchable catalog beneath it, replacing the four fixed cards.
- Setup wizard, installer transcript: Postgres 18, not 16.
- People screen: a Modules column and a per-module access editor.
- Settings: Modules page, Updates page with roll back, Storage and backups page,
  AI settings catalog status line and upload control.

Domains: the product site is bemmoly.com, the installer one-liner is served from get.bemmoly.com, and release manifests are GitHub release assets.
