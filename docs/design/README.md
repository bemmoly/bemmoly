# Design mocks

`mocks/` holds the 17 product screens that are the pixel source of truth for Bemmoly.
Open `mocks/Bemmoly App.dc.html` in a browser; it links to every other screen. Under
"Configuration and admin" it includes the three System settings screens:
`Bemmoly Modules Settings.dc.html`, `Bemmoly Updates Settings.dc.html` and
`Bemmoly Backups Settings.dc.html`.
Each file is self-contained HTML plus `support.js`; the data behind a screen lives in a
`class Component extends DCLogic` block near the end of the file.

`mocks-export.zip` is the original export. The extracted files are what the code is built from.
Every mock carries the designed Bemmoly mark in place of the export's placeholder logo.

Changes the tech design has queued for the mocks (the design is otherwise followed exactly):

- Settings › AI and models: the catalog status line ("Live · models.dev · updated 4 minutes ago")
  and the catalog upload control. There is no AI settings mock yet; the wizard's AI step shows
  the status line pattern to follow.

Domains: the product site is bemmoly.com, the installer one-liner is served from get.bemmoly.com, and release manifests are GitHub release assets.
