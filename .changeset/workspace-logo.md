---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/api-client': minor
'@bemmoly/web': minor
---

Workspace logo upload. Admins with the appearance capability can upload a PNG, SVG or WebP logo
in Settings › Appearance (up to 1 MB, square or near-square, at least 128 px; SVGs with scripts
or links are refused), with a live preview of the sidebar and the collapsed rail in light and
dark, and Replace and Remove with Undo. The logo takes line one of the sidebar ("on Bemmoly"
stays under it), leads the collapsed rail with the Bemmoly mark at its foot, leads the sign-in
page above "Powered by Bemmoly", and appears in emails when the workspace URL is https. The
favicon and tab title stay Bemmoly. New endpoints: `POST` and `DELETE /api/v1/workspace/logo`,
and an anonymous, cached `GET /api/v1/workspace/logo/:file`; setup status now includes
`logoUrl`. No schema or configuration change.
