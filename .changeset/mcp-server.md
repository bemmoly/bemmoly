---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/server': minor
'@bemmoly/web': minor
'@bemmoly/core-web': minor
'@bemmoly/module-work': minor
'@bemmoly/module-docs': minor
---

Bemmoly now has a built-in MCP server, so AI desktop apps, coding agents and IDEs can work in
your workspace as you. Point a client at `/mcp` for every module, or at `/mcp/work` or
`/mcp/docs` for one. It offers search, the Work and Docs tools the palette uses, issues,
projects, spaces and pages as readable resources, and two prompts. Every call runs with your
permissions, writes land in the audit log, and requests are rate limited.

An admin turns it on, and picks the modules it exposes, in Settings › MCP server. It is off by
default, and the AI settings do not affect it. Everyone can create personal access tokens in
Settings › Access tokens: read only or read and write, for every module or only some, shown once
and stored as a hash. A token limited to some modules is held to them in the REST API too. See
`docs/mcp.md` to connect a client.
