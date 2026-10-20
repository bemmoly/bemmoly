---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/editor': minor
'@bemmoly/ui': minor
'@bemmoly/module-docs': minor
---

Pages can hold PDF and HTML files. Add one with the new File block (/file), or drop or paste
it into a page; it shows as a preview with Expand to full screen, and images gain Expand too.
Agents add files over MCP with `docs_upload_file`, at the end of a page or anywhere in its
Markdown. HTML runs in a sandbox with an origin of its own: it may load scripts, styles, fonts
and images over https but cannot send data anywhere, and opened outside a page it downloads
instead of showing (ADR 0047). No schema or configuration change; uploads keep the
`BEMMOLY_UPLOAD_MAX_BYTES` limit.
