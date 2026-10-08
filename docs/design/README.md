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

Setup wizard changes the owner asked for on 2026-10-08, built in code first and to be folded back
into `Bemmoly Setup.dc.html`:

- Step 1: the admin form is two labelled groups, "Workspace" (name, URL) and "Your account"
  (name, email, password), one field per row with a one-line description under each group label,
  instead of the two-column grid. The URL field is recessed and carries a hint saying it was
  filled from the browser address.
- Step 2: the three importer cards show a neutral COMING SOON badge and cannot be selected until
  importers ship; "Start clean" is pre-selected and the primary reads "Continue" rather than
  "Start import in background". The notice text is new.
- Step 3: the sign-on cards show COMING SOON with no connect buttons and no RECOMMENDED badge,
  so they are shorter than in the mock. The "Or invite by email" card is a proper section with a
  heading and a defaults line; the delivery note sits under the role and team pickers.
- Option tiles on the import, sign-on and provider cards and in the provider list show logos
  (models.dev provider marks, simple-icons import marks, Google's sign-in "G") or design-system
  glyphs instead of initials. Initials remain the fallback.
- Step 5 and Settings › Appearance: clicking a theme tile previews that theme on the whole page
  at once; Save or Finish makes it permanent, Back, Skip or Discard reverts it. The mocks show no
  state for this.
- Step 6: skipped rows (import, AI, theme) show an empty circle and lighter text; the mock shows
  only the case where every step was set.
- The rail note drops its second sentence and reads only "Everything here can be changed later
  in Workspace settings."
- Default look: before a workspace theme exists the app renders Classic light regardless of the
  OS setting; there is no "follow the OS" choice any more. Whether the user menu should offer a
  "Match system" entry is open.

Domains: the product site is bemmoly.com, the installer one-liner is served from get.bemmoly.com, and release manifests are GitHub release assets.
