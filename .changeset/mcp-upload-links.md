---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/module-docs': minor
---

Agents can attach files up to `BEMMOLY_UPLOAD_MAX_BYTES` (10 MiB by default) to Docs pages
over MCP, not only the roughly 700 KB that fits inside one tool call. The new MCP tool
`docs.create_upload_link` hands out a single-use upload address, valid for 15 minutes, for one
file in one page; the agent sends the bytes to it with HTTP `PUT` (`curl -T`), then places the
file with `docs.upload_file` and the returned `fileId`. The link acts only as the person and
connection that asked for it, with the same checks as other uploads, and revoking the token or
disconnecting the app ends it (ADR 0048). Schema: changeset `0505-file-upload-links` adds the
`file_upload_links` table, fast and reversible. No configuration change.
