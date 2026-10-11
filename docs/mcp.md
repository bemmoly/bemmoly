# Connecting an MCP client

Bemmoly has a built-in [Model Context Protocol](https://modelcontextprotocol.io) server, so AI
desktop apps, coding agents and IDEs can read and change your workspace. It is served by the same
process as the app; there is nothing extra to install or run.

Every call runs as the person whose access token the client uses, with exactly their
permissions: the same module access, project and space membership and capabilities as the web
app. A client can never see or do more than its person can.

## 1. An admin turns it on

**Settings › MCP server** (needs the _Manage workspace settings_ capability).

- **Allow MCP clients.** Off by default. While it is off every client is refused, whatever token
  it holds. The AI settings do not affect MCP: clients bring their own model.
- **Exposed modules.** Every enabled module, or only the ones you choose. A disabled module, or one
  that is not exposed, contributes nothing.

## 2. Each person creates an access token

**Settings › Access tokens** (everyone signed in). Pick:

- **Access:** _Read only_ (clients can search and read; write tools are hidden and refused) or
  _Read and write_.
- **Modules:** every module you can open, or only some (a token limited to Work cannot reach Docs,
  over MCP or the REST API).
- **Expiry:** 30 days, 90 days or never.

The token is shown once. It is stored only as a hash; revoke it from the same page.

## 3. Point the client at the server

| URL                       | Reaches                                         |
| ------------------------- | ----------------------------------------------- |
| `https://<host>/mcp`      | every exposed module                            |
| `https://<host>/mcp/work` | one module (`work`, `docs`, …)                  |
| `https://<host>/mcp?modules=work,docs` | the listed modules                 |

The transport is **Streamable HTTP** (MCP spec 2025-11-25), stateless: each request is a `POST`
carrying `Authorization: Bearer <token>`. Most clients take a configuration like this one, which
Settings › MCP server shows with your address filled in:

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
  an audit row (`mcp.tool_called`) for every write.
- **Resources.** `bemmoly://work/projects/{key}`, `bemmoly://work/issues/{key}`,
  `bemmoly://docs/spaces/{key}` and `bemmoly://docs/pages/{id}`, as Markdown. Projects and spaces
  are listed; issues and pages are reachable through the templates.
- **Prompts.** `work.triage_issue` and `docs.review_page`.

## Limits and errors

- 120 requests per person per minute (`BEMMOLY_RATE_LIMIT_MCP_PER_USER`). Refused tokens count
  toward the per-address budget for refused credentials.
- `401` with `WWW-Authenticate: Bearer`: missing, expired or revoked token.
- `403`: MCP is turned off (`details.reason: "mcp_disabled"`).
- `404`: the module in the URL is not enabled or not exposed.
- A tool the person may not use answers with a tool error the model can read, not a failure.

## For module authors

A module's AI tools (`ctx.ai.addTool`) are served over MCP as they are. A module adds resources,
prompts and MCP-only tools with `ctx.mcp.addResource`, `ctx.mcp.addPrompt` and `ctx.mcp.addTool`;
names start with the module id and resource URIs live under `bemmoly://<module id>/`.

## Not yet

OAuth from the MCP authorization spec is not implemented; clients authenticate with personal
access tokens only.
