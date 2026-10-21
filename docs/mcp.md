# Connecting an MCP client

Bemmoly has a built-in [Model Context Protocol](https://modelcontextprotocol.io) server, so AI
desktop apps, coding agents and IDEs can read and change your workspace. It is served by the same
process as the app; there is nothing extra to install or run.

Every call runs as the person the client signed in as (or whose access token it uses), with
exactly their permissions: the same module access, project and space membership and capabilities as the web
app. A client can never see or do more than its person can.

## 1. An admin turns it on

**Settings › MCP server** (needs the _Manage workspace settings_ capability).

- **Allow MCP clients.** Off by default. While it is off every client is refused, whatever token
  it holds. The AI settings do not affect MCP: clients bring their own model.
- **Exposed modules.** Every enabled module, or only the ones you choose. A disabled module, or one
  that is not exposed, contributes nothing.

## 2. Point the client at the server

| URL                       | Reaches                                         |
| ------------------------- | ----------------------------------------------- |
| `https://<host>/mcp`      | every exposed module                            |
| `https://<host>/mcp/work` | one module (`work`, `docs`, …)                  |
| `https://<host>/mcp?modules=work,docs` | the listed modules                 |

The transport is **Streamable HTTP** (MCP spec 2025-11-25), stateless: each request is a `POST`
carrying `Authorization: Bearer <token>`. A client gets that token one of two ways.

### Sign in (OAuth)

Clients that support the MCP authorization spec need only the address, which Settings › MCP
server shows filled in:

```json
{
  "mcpServers": {
    "bemmoly": {
      "type": "http",
      "url": "https://bemmoly.example.com/mcp"
    }
  }
}
```

Leave out any `Authorization` header: a client that has one sends it and never offers to sign
in. On first connect the
client gets a `401` naming the protected resource metadata, finds Bemmoly's authorization server
from it, and opens your browser at `/oauth/authorize`:

1. You sign in as usual (password or single sign-on).
2. The consent screen shows the app, the site that vouches for it and the address it sends you
   back to (with a warning when that is an app on your own computer).
3. You choose **Read only** or **Read and write** and the modules, never more than the app asked
   for, then **Connect** or **Deny**.

What the client receives:

- An **access token** valid for one hour, bound to the address it connected to: a token for
  `/mcp/work` does not open `/mcp` or `/mcp/docs`; a token for `/mcp` opens both.
- A **refresh token** valid for 30 days, replaced every time it is used. Presenting a used
  refresh token (or a used authorization code) is treated as theft and ends the connection.
- Both are stored only as hashes. See and disconnect connected apps under **Settings › Access
  tokens › Connected apps**; deactivating a person ends all of theirs.

How the client is known: by a **client ID metadata document**, the https address of a small JSON
file the app's publisher hosts (`client_id`, `client_name`, `redirect_uris`). Bemmoly reads it
when you open the consent screen (public addresses only, unless `BEMMOLY_ALLOW_PRIVATE_URLS`; no
redirects; at most 16 KB; cached up to a day). Redirects must be https or `http://localhost`
(any port). **Dynamic client registration is not offered**: the spec makes it optional, and it
would be an anonymous endpoint that creates clients. A client that only registers dynamically
uses a personal access token instead.

| Endpoint                                                | What                                   |
| ------------------------------------------------------- | -------------------------------------- |
| `/.well-known/oauth-protected-resource/mcp[/<module>]`  | protected resource metadata (RFC 9728) |
| `/.well-known/oauth-authorization-server`               | authorization server metadata (RFC 8414) |
| `/oauth/authorize`                                      | the consent screen (code flow, PKCE S256 only) |
| `/oauth/token`                                          | `authorization_code` and `refresh_token`; public clients, no secret |
| `/oauth/revoke`                                         | token revocation (RFC 7009); revokes the whole connection |

Scopes: `mcp:read`, `mcp:write`, and `module:<id>` to ask for one module. A client that names no
access scope may be given either; the person decides.

### A personal access token

**Settings › Access tokens** (everyone signed in). Pick:

- **Access:** _Read only_ (clients can search and read; write tools are hidden and refused) or
  _Read and write_.
- **Modules:** every module you can open, or only some (a token limited to Work cannot reach Docs,
  over MCP or the REST API).
- **Expiry:** 30 days, 90 days or never.

The token is shown once. It is stored only as a hash; revoke it from the same page. Use it for CI,
scripts and clients that cannot open a browser; Settings › MCP server shows this configuration
under _Without a browser_:

```json
{
  "mcpServers": {
    "bemmoly": {
      "type": "http",
      "url": "https://bemmoly.example.com/mcp",
      "headers": { "Authorization": "Bearer <your token>" }
    }
  }
}
```

## What a client gets

Names are namespaced by module, so a client connected to one module sees only that module.

- **Tools.** `bemmoly.search` searches everything the connection reaches. Work and Docs serve the
  same tools the ⌘K palette's planner uses, with the same input schemas as the API
  (`work.search_issues`, `work.get_issue`, `work.set_priority`, `work.add_comment`,
  `docs.search_pages`, `docs.get_page`, `docs.set_page_status`, …). Write tools are listed only
  for read-and-write tokens. Your client asks you before running a tool; Bemmoly then runs it
  through the same services and checks as the UI, signs comments "via MCP for <you>", and writes
  an audit row (`mcp.tool_called`) for every write. A write that makes something returns it:
  `work.create_issue` answers with the new issue's `key`, `id` and `href`.
- **Moving issues in.** `work.list_projects`, `work.create_project`, `work.get_project` (each
  issue type with its fields and which are required) and `work.list_statuses` give a client what
  it needs to create issues right the first time. `work.create_issue` takes the type by name,
  `customFields` by field key, a starting `status` by name (any status of the workflow, so done
  work arrives done), `assigneeEmail`, `parentKey` and a Markdown description; then
  `work.update_issue`, `work.delete_issue` and `work.link_issues` tidy up.
- **Files in pages.** `docs.upload_file` adds an HTML page, a PDF or an image to a page, sent
  inline (text for HTML, base64 otherwise) while it fits in one request, about 700 KB. A larger
  file, up to `BEMMOLY_UPLOAD_MAX_BYTES` (10 MiB by default), goes in three steps, so the bytes
  never pass through the model:
  1. `docs.create_upload_link` with `pageId` and `name` answers with a single-use `url`, valid
     for 15 minutes, and the `command` to send the file.
  2. The agent sends the raw bytes there with HTTP `PUT` and no other credential, for example
     `curl --fail-with-body -T report.pdf '<url>'`. It answers `201` with the stored file's `id`.
  3. `docs.upload_file` with `pageId` and that `fileId` adds it at the end of the page (or, with
     `append: false`, returns the Markdown to place with `docs.update_page`).

  The link stores one file for that page as you, with the same checks as the editor's uploads:
  you must still be able to edit the page and the connection must still be live, so revoking a
  token or disconnecting an app ends its links. Bytes the server refuses (empty, too large, not
  an accepted type) leave the link usable until it expires. ADR 0048 has the reasoning.
- **Resources.** `bemmoly://work/projects/{key}`, `bemmoly://work/issues/{key}`,
  `bemmoly://docs/spaces/{key}` and `bemmoly://docs/pages/{id}`, as Markdown. Projects and spaces
  are listed; issues and pages are reachable through the templates.
- **Prompts.** `work.triage_issue` and `docs.review_page`.

## Limits and errors

- 120 requests per person per minute (`BEMMOLY_RATE_LIMIT_MCP_PER_USER`). Refused tokens count
  toward the per-address budget for refused credentials.
- 60 requests per address per minute to the OAuth discovery, token and revocation endpoints
  (`BEMMOLY_RATE_LIMIT_OAUTH_PER_IP`); 30 consent screens per person per minute.
- `401` with `WWW-Authenticate: Bearer resource_metadata="…"`: missing, expired or revoked
  token, or a token for another MCP address (`error="invalid_token"`).
- `403`: MCP is turned off (`details.reason: "mcp_disabled"`).
- `404`: the module in the URL is not enabled or not exposed.
- A tool the person may not use answers with a tool error the model can read, not a failure.
- Upload links: `404` with `details.reason` `used`, `expired` or `unknown`; `403` when the
  person may no longer edit the page or the connection has ended (`details.reason: "revoked"`);
  `413` over `BEMMOLY_UPLOAD_MAX_BYTES`. They share the upload budget of 30 a minute per address
  (`BEMMOLY_RATE_LIMIT_UPLOADS_PER_USER`).

## For module authors

A module's AI tools (`ctx.ai.addTool`) are served over MCP as they are. A module adds resources,
prompts and MCP-only tools with `ctx.mcp.addResource`, `ctx.mcp.addPrompt` and `ctx.mcp.addTool`;
names start with the module id and resource URIs live under `bemmoly://<module id>/`.

## Not yet

Dynamic client registration and confidential clients (`private_key_jwt`) are not supported; see
ADR 0026.
