# ADR 0048: MCP clients upload large files through single-use upload links

- Status: accepted
- Date: 2026-10-20
- Changes: ADR 0026 (an MCP client's only credential is its access token, and `/api/v1` refuses
  OAuth access tokens) and ADR 0047 (agents add files with `docs_upload_file`, the bytes inline)
- Evidence: the MCP request body limit (1 MiB), which caps a base64 file near 700 KB; agent
  output, where a PDF report is often several megabytes; how object stores hand out pre-signed
  upload URLs

## Context

`docs_upload_file` takes the file inside the tool call: text for HTML, base64 for PDF and
images. The MCP request body is capped at 1 MiB, so a binary file over roughly 700 KB cannot be
sent at all, while uploads elsewhere go up to `BEMMOLY_UPLOAD_MAX_BYTES` (10 MiB by default).

Three ways were weighed:

- **Let the MCP access token call `POST /api/v1/files`.** The token belongs to the MCP client,
  not to the model driving it: an agent that wants to send a file sees the tools, never the
  `Authorization` header. It would also open `/api/v1` to OAuth tokens, which ADR 0026 keeps
  out so that a connection's reach stays exactly the MCP tools the person approved.
- **Chunked tool calls.** Works with any client, but every byte still passes through the model
  as base64: a 5 MB PDF is about 7 MB of tool arguments, spread over seven or more calls the
  model must write out. Slow, costly and fragile.
- **A link the tool hands out.** The model asks for a link, and whatever can read the file
  (the agent's shell, a script, the client) sends the bytes to it directly. The file never goes
  through the model.

## Decision

1. **Docs offers `docs_create_upload_link`, an MCP-only write tool.** Given a page and a file
   name, it returns an `https` URL, its expiry, the size limit and the command to send the file
   (`curl --fail-with-body -T <file> '<url>'`). It is listed only for read-and-write
   connections, audited like any MCP write (`mcp.tool_called`), and is not offered to the
   in-app planner, which has no shell to send bytes with.
2. **The link is a credential of its own: single use, short lived, bound.** A 32-byte random
   token (`bmu_…`) stored as its sha256 only, valid for 15 minutes, for one target (the page),
   one file name and the person and connection that asked for it. The kernel's files service
   creates it after the same check as an upload (the person may edit the target) and only for
   a personal access token or an OAuth connection, never for a session, a plan or a rule:
   only those can be checked again when the link is used.
3. **`PUT /api/v1/upload-links/:token` takes the bytes, anonymous by design.** The token in the
   path is the credential, so the route takes no cookie or `Authorization` header and needs no
   client support beyond an HTTP `PUT`. It claims the link atomically before reading anything
   else, so two requests with one link store at most one file. Then, as that person:
   - the connection must still be live (the personal token neither revoked nor expired, the
     OAuth connection not revoked, the person active), still allowed to write and still
     limited to modules that include the target's, so revoking a connection also ends its
     links;
   - the upload runs through the files service unchanged: module enabled, module access, the
     target's own authorization, the size limit, byte sniffing and the target's accepted types
     (ADR 0047).
   A file the service refuses as invalid (empty, too large, a type the target does not take)
   gives the link back, so the agent can send the right bytes before it expires; every other
   refusal spends it. It answers `201` with the stored file (`id`, `url`, `name`, `mime`,
   `size`).
4. **Placing the file stays a tool call.** `docs_upload_file` takes `fileId` in place of
   `content`: a file already stored on that page is added at its end (or its Markdown returned
   with `append: false`), with the same undo as an inline upload.
5. **The token never reaches a log.** The request logger redacts the segment after
   `/upload-links/`; uploads through links share the per-address upload budget
   (`BEMMOLY_RATE_LIMIT_UPLOADS_PER_USER`).

## Consequences

- A table `file_upload_links` in changeset `0505-file-upload-links`; housekeeping deletes links a
  day after they expire.
- An agent with a shell attaches files up to `BEMMOLY_UPLOAD_MAX_BYTES`; one without a shell
  still has inline `content` up to about 700 KB.
- The URL in the model's context is a credential for 15 minutes. It can add one file to one
  page as the person, nothing more, and a transcript that outlives the link holds nothing
  usable.
- Other modules can hand out links for their own targets through `ctx.files.createUploadLink`.
- A link already handed out keeps working for its 15 minutes if an admin turns MCP off or
  stops exposing the module; the person's own rights and the connection are what it checks.

## Alternatives

- **The MCP token on `POST /api/v1/files`.** Rejected: see above; the model cannot use the
  token, and it widens what an OAuth connection reaches.
- **Chunked tool calls.** Rejected: the bytes still go through the model.
- **A longer-lived or reusable link.** Rejected: one file per link keeps a leaked URL worth one
  file, and asking again costs one tool call.
