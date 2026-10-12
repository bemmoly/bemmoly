# @bemmoly/eslint-plugin

## 1.1.0

No changes in this release.

## 1.0.0

### Patch Changes

- 1e9cdf9: Docs pages export to PDF files when an install runs the new optional PDF renderer: Export as PDF
  in a page's More menu and the export dialog make a PDF on A4 or Letter with the title and page
  numbers on every page, a contents page for a page and the pages under it, coloured code,
  tables, images and issue chips. One page downloads when it is ready; a bigger export arrives in
  the inbox with a download link, and files are kept for a day. Without the renderer nothing
  changes: PDF stays the browser's print view, now set in the new print type.

  For admins: the renderer is a pinned headless Chromium image that runs locked down and with no
  network beside the app. Turn it on with the `pdf` Compose profile and
  `BEMMOLY_PDF_URL=http://pdf:3000`, with `pdf.enabled=true` in the Helm chart, or by building
  the air-gap bundle with `BEMMOLY_AIRGAP_PDF=true` (deploy/README.md, "PDF export"). New
  settings: `BEMMOLY_PDF_URL`, `BEMMOLY_PDF_TIMEOUT_MS`, `BEMMOLY_PDF_MAX_BYTES`. Schema: the
  Docs changeset `0017-docs-page-exports` adds the `page_exports` table (fast, reversible).

## 0.13.1

### Patch Changes

- 9288d90: The "Import from Jira" and "Import from Confluence" cards in Setup and Settings › Import
  now show a neutral import icon instead of the vendor’s logos; the product names stay as plain
  labels. A new lint rule, `bemmoly/no-atlassian-marks`, keeps the vendor’s logos out of the
  codebase.

## 0.13.0

No changes in this release.

## 0.12.0

### Minor Changes

- 403ef1d: Bemmoly is ready to speak other languages. Settings › Profile has a Language setting, saved on
  your account so every device follows it: Automatic follows your browser, or pick a language.
  English is the only language shipped so far, so nothing reads differently today; dates, times and
  numbers now follow your language through the browser's own formatting. Settings › Workspace
  offers only the languages Bemmoly ships.

  For people building Bemmoly: the sidebar, menus, page header, phone bar, sign-in and Profile read
  their words from message catalogs (ICU, one per namespace, compiled at build time), modules can
  bring their own through `@bemmoly/core-web`, and `?locale=en-XA` shows a screen in an accented,
  padded pseudo-language for checking layout. API error bodies may now carry `messageId` and
  `values` beside `message`; existing clients are unaffected. The password reset email is written
  through the server's catalog in the workspace's language. See `docs/i18n.md` and ADR 0025.

## 0.11.0

No changes in this release.

## 0.10.0

No changes in this release.

## 0.9.0

No changes in this release.

## 0.8.0

No changes in this release.

## 0.7.0

No changes in this release.

## 0.6.0

No changes in this release.

## 0.5.0

No changes in this release.

## 0.4.0

### Minor Changes

- 2ab05df: Bemmoly takes on its logo's colours and a quieter visual system. The accent is the logo blue
  (the mid blue in dark mode), AI is the logo lilac and nothing else, and epics have their own
  violet. Every text grey now reads at 4.5:1 or better on every surface in every theme, so muted
  text that was hard to read is fixed everywhere at once, and the Midnight and Ocean themes get
  readable primary buttons. Type, radii and shadows are fewer and consistent.

  Icons are drawn instead of typed, so they look the same on every computer: issue types are
  tiles with a drawn mark, priority is three neutral bars with only the most urgent level in red,
  and keyboard shortcuts are drawn keys ("Ctrl" off Apple platforms). Custom issue types show
  their own icon and colour instead of a task's, and Settings › Issue types shows every type's
  icon rather than a stored character. Status pills follow their category, so In review and QA
  read as in progress (blue). Avatars are solid colours with white initials, labels are outlined
  pills with their own colour, and project, team and module tiles share one shape.

  Workspace logo colours no longer recolour the Bemmoly mark under a custom theme. Tooltips name
  their shortcut, deleting something reversible shows Undo for six seconds, relative times show
  the full date on hover, and every keyboard focus shows the same ring.

  Workflow status colours stored by earlier versions are drawn as their nearest new colour, and
  the issue type icon field now takes an icon name of up to 40 characters. No configuration or
  schema change.

## 0.3.0

No changes in this release.

## 0.2.2

No changes in this release.

## 0.2.1

No changes in this release.

## 0.2.0

No changes in this release.

## 0.1.7

No changes in this release.

## 0.1.6

No changes in this release.

## 0.1.5

No changes in this release.

## 0.1.4

No changes in this release.

## 0.1.3

No changes in this release.

## 0.1.2

No changes in this release.

## 0.1.1

No changes in this release.

## 0.1.0

No changes in this release.
