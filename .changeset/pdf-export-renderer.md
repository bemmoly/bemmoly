---
'@bemmoly/module-docs': minor
'@bemmoly/core': minor
'@bemmoly/editor': minor
'@bemmoly/ui': minor
'@bemmoly/server': minor
'@bemmoly/deploy': minor
'@bemmoly/eslint-plugin': patch
---

Docs pages export to PDF files when an install runs the new optional PDF renderer: Export as PDF
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
