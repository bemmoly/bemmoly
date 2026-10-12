---
'@bemmoly/core': minor
'@bemmoly/shared': minor
'@bemmoly/api-client': minor
'@bemmoly/ui': minor
'@bemmoly/web': minor
'@bemmoly/module-work': minor
'@bemmoly/module-docs': minor
'@bemmoly/server': patch
---

Importing from Jira and Confluence handles big sites. Connecting now only lists projects or
spaces, so it answers in seconds even with 1,500 projects. Then you choose in a searchable,
filterable list that shows each project's type, lead and issue count. Counts load as rows come
into view. The list marks projects imported before, keys already in use here, and projects the
token can't read. It has a tri-state select all, Shift ranges, ⌘A, and Undo after clearing.
Selecting "all except a few" works at any size: the 500-project limit is gone. Confluence also
lists personal spaces, which start unticked. Jira Cloud counts come from project search's
`expand=insight`, which Jira marks experimental, and fall back to one count per project when
it is missing.

Admins: kernel changeset `0502-import-containers` adds the `import_containers` table and
enables `pg_trgm`, which Bemmoly already requires. It copies the projects and spaces of
existing import jobs into the new table.
