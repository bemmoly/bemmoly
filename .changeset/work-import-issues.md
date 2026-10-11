---
'@bemmoly/module-work': minor
---

Agents can import issues from another tracker with the `work_import_issues` tool (over MCP as
`work.import_issues`): up to 200 issues per call with title, Markdown description, type and
status by name, priority, assignee and reporter by email, labels, parent, original created,
updated and resolved times, and comments. The external key ("TRP-12") keeps its number when
it is free in the project and is remembered, so sending it again updates the issue instead of
duplicating it; an issue edited in Bemmoly since is left alone and reported. Comments by
someone without an account are posted by the caller, opening with "Originally by <name> on
<date>". The call needs edit rights on the project and the import capability (workspace
settings). No schema change: it uses the importers' mapping table under the source "mcp".
