---
'@bemmoly/module-work': patch
---

Work projects now have labels, versions and components you can list, create, rename and delete
under `/api/v1/work/projects/:key/labels`, `/versions` and `/components`. The lists come back in
name order and take a name prefix (`?q=`), so the create form and the issue page can offer them
as you type. A version has a planned release date and a status; marking it released records
when, and moving it back to unreleased clears that. A component can name an active person as
its lead. Anyone who can edit issues can add a label; everything else needs project
configuration. Each change is written to the audit log. No configuration or schema change.
