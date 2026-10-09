---
'@bemmoly/shared': minor
---

Add the Bemmoly Query Language (LQL) parser that the Work module's filter bar, swimlane
queries, saved filters and automation conditions share. A query such as
`project = PLT AND status != Done AND assignee = me AND "spec doc" IS EMPTY ORDER BY updated DESC`
is parsed into a syntax tree, checked against the issue fields (project, key, type, status,
status category, priority, assignee, reporter, parent, epic, sprint, estimate, due, created,
updated, fix version, label, text and `cf.<key>` for custom fields), and printed back in a
canonical form so saved filters are stored one way. Mistakes come back with the exact position
and what was expected, so the filter bar can underline them, and autocomplete offers the
fields, operators, keywords and values that fit where the cursor is. Compiling a query to SQL
lives in the Work module, not here. No configuration or schema change.
