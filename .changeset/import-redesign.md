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

Before you start, Options lets you choose what to bring: comments, attachments, sprints and
boards, and links. For Confluence, comments and attachments. It also sets where each project
or space goes: a new one with a key you can edit, or an existing one, with numbers continuing
from its last key. A key that is already taken is now an error you fix; it is never merged
into the project or space that holds it. Imports used to merge silently in that case. Options
also matches people by email when you plan, and lets you pick a member or keep a placeholder
for anyone. Review sums up what Start will do.

While it runs, the import shows an overall percentage that never goes back and one row per
project or space. A project or space that fails no longer fails the others. The import ends
"finished with errors", gives the reason in plain words (for example, Jira kept answering "too
many requests"), and Retry carries it on from where it stopped. The report groups results by
project with Open board, and offers every skipped record as a CSV download. Whoever started the
import gets an Inbox notice when it ends. The setup wizard keeps to Connect and Choose,
starts the import in the background with the default options, and no longer promises change
history.

Admins: kernel changeset `0502-import-containers` adds the `import_containers` table and
enables `pg_trgm`, which Bemmoly already requires. It copies the projects and spaces of
existing import jobs into the new table. `0503-import-plan-options` adds target columns to it
and the `import_people` table. `0504-import-progress` adds per-container progress columns, the
`import_skips` table and the `completed_with_errors` job status (a previous release's client
shows such a job as unknown).
